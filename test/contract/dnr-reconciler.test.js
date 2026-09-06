import assert from "node:assert/strict";
import test from "node:test";

import { createChromeDnrAdapter } from "../../src/adapters/chrome-dnr.js";
import { createDnrReconciler } from "../../src/adapters/dnr-reconciler.js";
import { createUserAgentRule } from "../../src/core/dnr-rules.js";
import { DNR_ERROR } from "../../src/core/dnr-error.js";
import { createHostPermissionInspection } from "../../src/core/permissions.js";
import { VERIFIED_PROFILE_SET } from "../../src/core/profiles.js";
import { createDefaultState } from "../../src/core/storage-schema.js";
import { FakeDnrApi } from "../helpers/fake-dnr.js";

const SITE_ID = "11111111-1111-4111-8111-111111111111";

function state(enabled = true, profile = "desktop") {
  return {
    ...createDefaultState(), enabled, nextRuleId: 2,
    sites: [{ id: SITE_ID, name: "Example", profile, hosts: [{ hostname: "example.com", ruleId: 1 }] }],
  };
}

function permissionPort(granted = true) {
  return {
    async inspectHosts(hostnames) {
      return hostnames.map((hostname) => createHostPermissionInspection(hostname, { https: granted, http: granted }));
    },
  };
}

function setup(initialRules = [], options = {}) {
  const api = new FakeDnrApi(initialRules, options);
  const dnr = createChromeDnrAdapter(api);
  return { api, dnr, reconciler: createDnrReconciler({ dnr, permissions: permissionPort() }) };
}

test("normal reconcile applies and verifies expected rules", async () => {
  const { api, reconciler } = setup();
  const result = await reconciler.reconcile(state());
  assert.equal(result.expectedRules.length, 1);
  assert.equal(api.rules.length, 1);
  assert.equal(api.calls.filter((call) => call.operation === "update").length, 1);
});

test("no-op reconcile reads twice and performs no update", async () => {
  const rule = createUserAgentRule({ id: 1, hostname: "example.com", userAgent: VERIFIED_PROFILE_SET.desktopUserAgent });
  const { api, reconciler } = setup([rule]);
  const result = await reconciler.reconcile(state());
  assert.deepEqual(result.diff.unchanged, [1]);
  assert.equal(api.calls.some((call) => call.operation === "update"), false);
});

test("same-ID header replacement uses verified remove then add phases", async () => {
  const desktop = createUserAgentRule({ id: 1, hostname: "example.com", userAgent: VERIFIED_PROFILE_SET.desktopUserAgent });
  const { api, reconciler } = setup([desktop]);
  await reconciler.reconcile(state(true, "mobile"));
  const updates = api.calls.filter((call) => call.operation === "update");
  assert.deepEqual(updates, [
    { operation: "update", removeRuleIds: [1], addRules: [] },
    { operation: "update", removeRuleIds: [], addRules: api.rules },
  ]);
  assert.equal(api.rules[0].action.requestHeaders[0].value, VERIFIED_PROFILE_SET.mobileUserAgent);
});

test("Mobile to Desktop replaces the stable rule with the Desktop profile", async () => {
  const mobile = createUserAgentRule({ id: 1, hostname: "example.com", userAgent: VERIFIED_PROFILE_SET.mobileUserAgent });
  const { api, reconciler } = setup([mobile]);
  await reconciler.reconcile(state(true, "desktop"));
  assert.deepEqual(api.rules.map((rule) => rule.id), [1]);
  assert.equal(api.rules[0].action.requestHeaders[0].value, VERIFIED_PROFILE_SET.desktopUserAgent);
});

test("Profile to Default removes the override without changing its stored rule ID", async () => {
  const desktop = createUserAgentRule({ id: 1, hostname: "example.com", userAgent: VERIFIED_PROFILE_SET.desktopUserAgent });
  const { api, reconciler } = setup([desktop]);
  const result = await reconciler.reconcile(state(true, "default"));
  assert.deepEqual(result.diff.removeRuleIds, [1]);
  assert.deepEqual(api.rules, []);
  assert.equal(state(true, "default").sites[0].hosts[0].ruleId, 1);
});

test("Default to Profile installs the stored stable rule ID", async () => {
  const { api, reconciler } = setup();
  await reconciler.reconcile(state(true, "mobile"));
  assert.deepEqual(api.rules.map((rule) => rule.id), [1]);
  assert.equal(api.rules[0].action.requestHeaders[0].value, VERIFIED_PROFILE_SET.mobileUserAgent);
});

test("replacement aborts when removed rule IDs remain active", async () => {
  const desktop = createUserAgentRule({ id: 1, hostname: "example.com", userAgent: VERIFIED_PROFILE_SET.desktopUserAgent });
  const { reconciler } = setup([desktop], { retainRemoved: true });
  await assert.rejects(reconciler.reconcile(state(true, "mobile")), (error) => error.code === DNR_ERROR.POST_CONDITION_FAILURE);
});

test("reconcile removes stale extension-owned dynamic rules", async () => {
  const stale = createUserAgentRule({ id: 9, hostname: "stale.example", userAgent: "UA" });
  const { api, reconciler } = setup([stale]);
  await reconciler.reconcile(state());
  assert.deepEqual(api.rules.map((rule) => rule.id), [1]);
});

test("Global OFF removes all extension dynamic rules", async () => {
  const stale = createUserAgentRule({ id: 9, hostname: "stale.example", userAgent: "UA" });
  const { api, reconciler } = setup([stale]);
  await reconciler.reconcile(state(false));
  assert.deepEqual(api.rules, []);
});

test("permission missing produces warning and no rule", async () => {
  const api = new FakeDnrApi();
  const reconciler = createDnrReconciler({ dnr: createChromeDnrAdapter(api), permissions: permissionPort(false) });
  const result = await reconciler.reconcile(state());
  assert.equal(result.expectedRules.length, 0);
  assert.deepEqual(result.warnings.map((item) => item.hostname), ["example.com"]);
});

test("permission loss removes an existing profile rule", async () => {
  const desktop = createUserAgentRule({ id: 1, hostname: "example.com", userAgent: VERIFIED_PROFILE_SET.desktopUserAgent });
  const api = new FakeDnrApi([desktop]);
  const reconciler = createDnrReconciler({ dnr: createChromeDnrAdapter(api), permissions: permissionPort(false) });
  const result = await reconciler.reconcile(state());
  assert.deepEqual(result.diff.removeRuleIds, [1]);
  assert.deepEqual(api.rules, []);
});

test("DNR API rejection is normalized", async () => {
  const { api, reconciler } = setup();
  api.fail("update");
  await assert.rejects(reconciler.reconcile(state()), (error) => error.code === DNR_ERROR.API_FAILURE);
});

test("incorrect application is rejected by post-condition", async () => {
  const { reconciler } = setup([], { incorrectApplication: true });
  await assert.rejects(reconciler.reconcile(state()), (error) => error.code === DNR_ERROR.POST_CONDITION_FAILURE);
});

test("fail closed removes all rules and verifies zero", async () => {
  const rule = createUserAgentRule({ id: 1, hostname: "example.com", userAgent: "UA" });
  const { api, reconciler } = setup([rule]);
  const result = await reconciler.failClosed("test");
  assert.equal(result.failedClosed, true);
  assert.deepEqual(api.rules, []);
});

test("fail-closed update rejection is a major failure", async () => {
  const rule = createUserAgentRule({ id: 1, hostname: "example.com", userAgent: "UA" });
  const { api, reconciler } = setup([rule]);
  api.fail("update");
  await assert.rejects(reconciler.failClosed("test"), (error) => error.code === DNR_ERROR.FAIL_CLOSED_FAILURE);
});

test("fail-closed post-condition mismatch is a major failure", async () => {
  const rule = createUserAgentRule({ id: 1, hostname: "example.com", userAgent: "UA" });
  const { reconciler } = setup([rule], { retainRemoved: true });
  await assert.rejects(reconciler.failClosed("test"), (error) => error.code === DNR_ERROR.FAIL_CLOSED_FAILURE);
});
