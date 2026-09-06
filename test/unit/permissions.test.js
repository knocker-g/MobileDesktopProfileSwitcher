import assert from "node:assert/strict";
import test from "node:test";

import { PERMISSION_ERROR } from "../../src/core/permission-error.js";
import {
  PERMISSION_STATE,
  createHostPermissionInspection,
  createPermissionAcquisitionPlan,
  exactOriginsForHost,
  inspectPermissionReadiness,
  planPermissionRelease,
  planSiteCreatePermissions,
  planSiteEditPermissions,
} from "../../src/core/permissions.js";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";

function site({ id = SITE_A, profile = "desktop", hosts = ["example.com"] } = {}) {
  return {
    id,
    name: "Example",
    profile,
    hosts: hosts.map((hostname, index) => ({ hostname, ruleId: index + 1 })),
  };
}

function absent(hostname) {
  return createHostPermissionInspection(hostname, { https: false, http: false });
}

test("generates only exact HTTPS and HTTP origins", () => {
  assert.deepEqual(exactOriginsForHost("www.youtube.com"), [
    "https://www.youtube.com/*",
    "http://www.youtube.com/*",
  ]);
  assert.ok(exactOriginsForHost("www.youtube.com").every((origin) => !origin.includes("*://")));
});

test("rejects non-canonical, wildcard, URL, IP, and single-label permission hosts", () => {
  for (const hostname of [
    "WWW.YouTube.COM",
    "www.youtube.com.",
    "*.youtube.com",
    "https://www.youtube.com/",
    "127.0.0.1",
    "localhost",
  ]) {
    assert.throws(
      () => exactOriginsForHost(hostname),
      (error) => error.code === PERMISSION_ERROR.INVALID_HOST,
    );
  }
});

test("classifies full, partial HTTPS, partial HTTP, and absent grants", () => {
  assert.equal(createHostPermissionInspection("example.com", { https: true, http: true }).state, PERMISSION_STATE.FULLY_GRANTED);
  assert.equal(createHostPermissionInspection("example.com", { https: true, http: false }).state, PERMISSION_STATE.PARTIAL_HTTPS);
  assert.equal(createHostPermissionInspection("example.com", { https: false, http: true }).state, PERMISSION_STATE.PARTIAL_HTTP);
  assert.equal(createHostPermissionInspection("example.com", { https: false, http: false }).state, PERMISSION_STATE.NOT_GRANTED);
});

test("readiness requires both schemes for every host and reports partial separately", () => {
  const full = createHostPermissionInspection("example.com", { https: true, http: true });
  const partial = createHostPermissionInspection("www.example.com", { https: true, http: false });
  assert.equal(inspectPermissionReadiness([full]).ready, true);
  const result = inspectPermissionReadiness([full, partial]);
  assert.equal(result.ready, false);
  assert.equal(result.reason, PERMISSION_ERROR.PARTIAL);
  assert.deepEqual(result.missingHosts, ["www.example.com"]);
});

test("multi-host acquisition plan is exact and duplicate-free", () => {
  const plan = createPermissionAcquisitionPlan([
    "example.com",
    "www.example.com",
    "example.com",
  ], [absent("example.com"), absent("www.example.com")]);
  assert.deepEqual(plan.hostnames, ["example.com", "www.example.com"]);
  assert.equal(plan.origins.length, 4);
  assert.equal(new Set(plan.origins).size, 4);
});

test("acquisition plan requests only missing scheme grants", () => {
  const inspection = createHostPermissionInspection("example.com", { https: true, http: false });
  const plan = createPermissionAcquisitionPlan(["example.com"], [inspection]);
  assert.deepEqual(plan.requestOrigins, ["http://example.com/*"]);
  assert.deepEqual(plan.priorGrantedOrigins, ["https://example.com/*"]);
});

test("Site create plan includes every canonical Site host", () => {
  const plan = planSiteCreatePermissions(
    site({ hosts: ["example.com", "www.example.com"] }),
    [absent("example.com"), absent("www.example.com")],
  );
  assert.deepEqual(plan.hostnames, ["example.com", "www.example.com"]);
});

test("Site edit plan requests added hosts only", () => {
  const current = site();
  const candidate = {
    ...site({ hosts: ["example.com", "www.example.com"] }),
    hosts: [
      { hostname: "example.com", ruleId: 1 },
      { hostname: "www.example.com", ruleId: 2 },
    ],
  };
  const plan = planSiteEditPermissions(current, candidate, [absent("www.example.com")]);
  assert.deepEqual(plan.hostnames, ["www.example.com"]);
  assert.equal(plan.origins.length, 2);
});

test("acquisition planning refuses to guess missing pre-request state", () => {
  assert.throws(
    () => createPermissionAcquisitionPlan(["example.com"], []),
    (error) => error.code === PERMISSION_ERROR.API_FAILURE,
  );
});

test("Default profile and Global OFF do not release hosts that remain stored", () => {
  const before = [site()];
  const defaultAfter = [site({ profile: "default" })];
  assert.deepEqual(planPermissionRelease(before, defaultAfter).origins, []);
  assert.deepEqual(planPermissionRelease(before, before).origins, []);
});

test("Site deletion releases exact origins for hosts no longer stored", () => {
  const plan = planPermissionRelease([site({ hosts: ["example.com", "www.example.com"] })], []);
  assert.deepEqual(plan.hostnames, ["example.com", "www.example.com"]);
  assert.equal(plan.origins.length, 4);
});

test("release plan never removes a host still used by the resulting collection", () => {
  const otherSite = site({ id: SITE_B, hosts: ["other.example.com"] });
  otherSite.hosts[0].ruleId = 2;
  const before = [site(), otherSite];
  const after = [site()];
  const plan = planPermissionRelease(before, after);
  assert.deepEqual(plan.hostnames, ["other.example.com"]);
  assert.ok(!plan.origins.some((origin) => origin.includes("//example.com/")));
});
