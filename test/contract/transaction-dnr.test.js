import assert from "node:assert/strict";
import test from "node:test";

import { createChromeDnrAdapter } from "../../src/adapters/chrome-dnr.js";
import { createDnrReconciler } from "../../src/adapters/dnr-reconciler.js";
import { createUserAgentRule } from "../../src/core/dnr-rules.js";
import { createHostPermissionInspection } from "../../src/core/permissions.js";
import { VERIFIED_PROFILE_SET } from "../../src/core/profiles.js";
import { createDefaultState, OPERATION_KIND } from "../../src/core/storage-schema.js";
import { createMutationExecutor } from "../../src/core/transaction.js";
import { TRANSACTION_ERROR } from "../../src/core/transaction-error.js";
import { FakeDnrApi } from "../helpers/fake-dnr.js";
import { MemoryStoragePort } from "../helpers/fakes.js";

const MUTATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SITE_ID = "11111111-1111-4111-8111-111111111111";

function state(profile = "desktop", hosts = [{ hostname: "example.com", ruleId: 1 }]) {
  return {
    ...createDefaultState(), nextRuleId: hosts.length + 1,
    sites: [{ id: SITE_ID, name: "Example", profile, hosts }],
  };
}

const permissions = {
  async inspectHosts(hostnames) {
    return hostnames.map((hostname) => createHostPermissionInspection(hostname, { https: true, http: true }));
  },
};

function mutation(profile) {
  return (current) => ({ ...current, sites: [{ ...current.sites[0], profile }] });
}

function setup(options = {}) {
  const oldRule = createUserAgentRule({ id: 1, hostname: "example.com", userAgent: VERIFIED_PROFILE_SET.desktopUserAgent });
  const api = new FakeDnrApi([oldRule], options);
  const reconciler = createDnrReconciler({ dnr: createChromeDnrAdapter(api), permissions });
  const storage = new MemoryStoragePort(state());
  const executor = createMutationExecutor({ storage, derivedState: reconciler, createMutationId: () => MUTATION_ID });
  return { api, storage, executor };
}

test("transaction derived apply reconciles the committed Mobile rule", async () => {
  const { api, storage, executor } = setup();
  await executor.execute({ expectedRevision: 0, operationKind: OPERATION_KIND.SET_PROFILE, mutate: mutation("mobile") });
  assert.equal(storage.rawState().revision, 1);
  assert.equal(api.rules[0].action.requestHeaders[0].value, VERIFIED_PROFILE_SET.mobileUserAgent);
});

test("multi-host Desktop to Mobile replaces every stable rule before adding Mobile rules", async () => {
  const hosts = [
    { hostname: "www.youtube.com", ruleId: 1 },
    { hostname: "m.youtube.com", ruleId: 2 },
  ];
  const oldRules = hosts.map((host) => createUserAgentRule({
    id: host.ruleId,
    hostname: host.hostname,
    userAgent: VERIFIED_PROFILE_SET.desktopUserAgent,
  }));
  const api = new FakeDnrApi(oldRules);
  const reconciler = createDnrReconciler({ dnr: createChromeDnrAdapter(api), permissions });
  const storage = new MemoryStoragePort(state("desktop", hosts));
  const executor = createMutationExecutor({ storage, derivedState: reconciler, createMutationId: () => MUTATION_ID });

  await executor.execute({ expectedRevision: 0, operationKind: OPERATION_KIND.SET_PROFILE, mutate: mutation("mobile") });

  assert.deepEqual(api.calls.filter((call) => call.operation === "update"), [
    { operation: "update", removeRuleIds: [1, 2], addRules: [] },
    { operation: "update", removeRuleIds: [], addRules: api.rules },
  ]);
  assert.deepEqual(api.rules.map((rule) => rule.id), [1, 2]);
  assert.deepEqual(
    api.rules.map((rule) => rule.action.requestHeaders[0].value),
    [VERIFIED_PROFILE_SET.mobileUserAgent, VERIFIED_PROFILE_SET.mobileUserAgent],
  );
});

test("derived apply failure enters transaction rollback and restores old expected rules", async () => {
  const { api, storage, executor } = setup({ failUpdateCalls: [2] });
  await assert.rejects(
    executor.execute({ expectedRevision: 0, operationKind: OPERATION_KIND.SET_PROFILE, mutate: mutation("mobile") }),
    (error) => error.code === TRANSACTION_ERROR.DERIVED_APPLY_FAILURE,
  );
  assert.equal(storage.rawState().revision, 0);
  assert.equal(api.rules[0].action.requestHeaders[0].value, VERIFIED_PROFILE_SET.desktopUserAgent);
});

test("rollback failure makes the transaction request DNR fail closed", async () => {
  const { api, storage, executor } = setup({ incorrectApplicationCalls: [2], failUpdateCalls: [3] });
  await assert.rejects(
    executor.execute({ expectedRevision: 0, operationKind: OPERATION_KIND.SET_PROFILE, mutate: mutation("mobile") }),
    (error) => error.code === TRANSACTION_ERROR.ROLLBACK_FAILURE,
  );
  assert.equal(storage.rawState().pendingMutation !== null, true);
  assert.deepEqual(api.rules, []);
});
