import assert from "node:assert/strict";
import test from "node:test";

import { createChromePermissionsAdapter } from "../../src/adapters/chrome-permissions.js";
import { PERMISSION_ERROR } from "../../src/core/permission-error.js";
import {
  PERMISSION_DECISION,
  PERMISSION_STATE,
  SITE_PERMISSION_STATUS,
  createHostPermissionInspection,
  createPermissionAcquisitionPlan,
  executePermissionRelease,
  executePermissionRequest,
  inspectStoredSitePermissions,
  planPermissionRelease,
} from "../../src/core/permissions.js";
import { FakeChromePermissionsApi } from "../helpers/fake-permissions.js";

const HOST = "example.com";
const ORIGINS = ["https://example.com/*", "http://example.com/*"];

function adapter(options) {
  const api = new FakeChromePermissionsApi(options);
  return { api, port: createChromePermissionsAdapter(api) };
}

function absent(hostname = HOST) {
  return createHostPermissionInspection(hostname, { https: false, http: false });
}

test("adapter inspects each exact origin and detects an external revoke", async () => {
  const { api, port } = adapter({ granted: ORIGINS });
  assert.equal((await port.inspectHosts([HOST]))[0].state, PERMISSION_STATE.FULLY_GRANTED);
  api.granted.delete(ORIGINS[1]);
  assert.equal((await port.inspectHosts([HOST]))[0].state, PERMISSION_STATE.PARTIAL_HTTPS);
  api.granted.clear();
  assert.equal((await port.inspectHosts([HOST]))[0].state, PERMISSION_STATE.NOT_GRANTED);
});

test("stored Site inspection exposes missing-or-revoked state for reconciliation", async () => {
  const sites = [{ id: "11111111-1111-4111-8111-111111111111", name: "Example", profile: "desktop", hosts: [{ hostname: HOST, ruleId: 1 }] }];
  const { api, port } = adapter({ granted: ORIGINS });
  assert.equal((await inspectStoredSitePermissions(sites, port)).status, SITE_PERMISSION_STATUS.READY);
  api.granted.clear();
  const result = await inspectStoredSitePermissions(sites, port);
  assert.equal(result.status, SITE_PERMISSION_STATUS.MISSING_OR_REVOKED);
  assert.deepEqual(result.missingHosts, [HOST]);
});

test("request is the first synchronous API effect and post-check succeeds", async () => {
  const { api, port } = adapter();
  const plan = createPermissionAcquisitionPlan([HOST], [absent()]);
  const resultPromise = executePermissionRequest(plan, port);
  assert.equal(api.calls[0].operation, "request");
  const result = await resultPromise;
  assert.equal(result.decision, PERMISSION_DECISION.READY);
  assert.equal(result.proceed, true);
  assert.deepEqual(api.calls[0].origins, ORIGINS);
});

test("denied request does not permit a Site mutation", async () => {
  const { port } = adapter({ requestResult: false });
  const result = await executePermissionRequest(createPermissionAcquisitionPlan([HOST], [absent()]), port);
  assert.equal(result.decision, PERMISSION_DECISION.DENIED);
  assert.equal(result.proceed, false);
});

test("request API rejection is normalized", async () => {
  const { api, port } = adapter();
  api.fail("request");
  await assert.rejects(
    executePermissionRequest(createPermissionAcquisitionPlan([HOST], [absent()]), port),
    (error) => error.code === PERMISSION_ERROR.API_FAILURE && error.details.operation === "request",
  );
});

test("true request with incomplete post-condition blocks mutation and cleans new grants", async () => {
  const { api, port } = adapter({ grantRequested: false });
  api.request = ({ origins }) => {
    api.calls.push({ operation: "request", origins: [...origins] });
    api.granted.add(origins[0]);
    return Promise.resolve(true);
  };
  const result = await executePermissionRequest(createPermissionAcquisitionPlan([HOST], [absent()]), port);
  assert.equal(result.decision, PERMISSION_DECISION.POST_CONDITION_FAILED);
  assert.equal(result.proceed, false);
  assert.equal(result.cleanupRequired, false);
  assert.equal(api.granted.size, 0);
});

test("partial request cleanup failure is surfaced without permitting mutation", async () => {
  const { api, port } = adapter({ grantRequested: false });
  api.request = ({ origins }) => {
    api.calls.push({ operation: "request", origins: [...origins] });
    api.granted.add(origins[0]);
    return Promise.resolve(true);
  };
  api.fail("remove");
  const result = await executePermissionRequest(createPermissionAcquisitionPlan([HOST], [absent()]), port);
  assert.equal(result.decision, PERMISSION_DECISION.POST_CONDITION_FAILED);
  assert.equal(result.proceed, false);
  assert.equal(result.cleanupRequired, true);
});

test("failed added-host acquisition preserves the existing Site decision", async () => {
  const plan = createPermissionAcquisitionPlan(["www.example.com"], [
    createHostPermissionInspection("www.example.com", { https: false, http: false }),
  ]);
  const { port } = adapter({ requestResult: false, granted: ORIGINS });
  const result = await executePermissionRequest(plan, port);
  assert.equal(result.proceed, false);
  assert.deepEqual(result.readiness.missingHosts, ["www.example.com"]);
});

test("remove success is verified by contains", async () => {
  const before = [{ id: "11111111-1111-4111-8111-111111111111", name: "Example", profile: "desktop", hosts: [{ hostname: HOST, ruleId: 1 }] }];
  const plan = planPermissionRelease(before, []);
  const { port } = adapter({ granted: ORIGINS });
  const result = await executePermissionRelease(plan, port);
  assert.equal(result.decision, PERMISSION_DECISION.REMOVED);
  assert.equal(result.released, true);
});

test("remove false is a removal failure decision", async () => {
  const plan = { hostnames: [HOST], origins: ORIGINS };
  const { port } = adapter({ granted: ORIGINS, removeResult: false });
  const result = await executePermissionRelease(plan, port);
  assert.equal(result.decision, PERMISSION_DECISION.REMOVE_FAILED);
  assert.equal(result.released, false);
});

test("remove API rejection is normalized as removal failure", async () => {
  const { api, port } = adapter({ granted: ORIGINS });
  api.fail("remove");
  await assert.rejects(
    executePermissionRelease({ hostnames: [HOST], origins: ORIGINS }, port),
    (error) => error.code === PERMISSION_ERROR.REMOVAL_FAILURE,
  );
});

test("remove true with remaining permission fails its post-condition", async () => {
  const { port } = adapter({ granted: ORIGINS, retainRemoved: true });
  const result = await executePermissionRelease({ hostnames: [HOST], origins: ORIGINS }, port);
  assert.equal(result.decision, PERMISSION_DECISION.POST_CONDITION_FAILED);
  assert.deepEqual(result.remainingHosts, [HOST]);
});

test("contains API rejection is normalized", async () => {
  const { api, port } = adapter();
  api.fail("contains");
  await assert.rejects(
    port.inspectHosts([HOST]),
    (error) => error.code === PERMISSION_ERROR.API_FAILURE && error.details.operation === "contains",
  );
});

test("remove post-check API rejection is a post-condition failure", async () => {
  const { api, port } = adapter({ granted: ORIGINS });
  const originalRemove = api.remove.bind(api);
  api.remove = async (details) => {
    const result = await originalRemove(details);
    api.fail("contains");
    return result;
  };
  await assert.rejects(
    executePermissionRelease({ hostnames: [HOST], origins: ORIGINS }, port),
    (error) => error.code === PERMISSION_ERROR.POST_CONDITION_FAILURE,
  );
});

test("execution rejects a forged wildcard acquisition plan before the API", () => {
  const { api, port } = adapter();
  assert.throws(
    () => executePermissionRequest({
      hostnames: [HOST],
      origins: ORIGINS,
      requestOrigins: ["https://*.example.com/*"],
      priorGrantedOrigins: [ORIGINS[1]],
    }, port),
    (error) => error.code === PERMISSION_ERROR.INVALID_HOST,
  );
  assert.equal(api.calls.length, 0);
});

test("execution rejects a forged broad release plan before the API", async () => {
  const { api, port } = adapter({ granted: ORIGINS });
  await assert.rejects(
    executePermissionRelease({ hostnames: [HOST], origins: ["https://*/*"] }, port),
    (error) => error.code === PERMISSION_ERROR.INVALID_HOST,
  );
  assert.equal(api.calls.length, 0);
});
