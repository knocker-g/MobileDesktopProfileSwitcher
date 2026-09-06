import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultState, stateWithPending, createPendingMutation, configurationOf, OPERATION_KIND } from "../../src/core/storage-schema.js";
import { PROFILE } from "../../src/core/profiles.js";
import { createRuntimeBackend } from "../../src/runtime/backend.js";
import { createRuntimeMessageHandler, initializeRuntime, MESSAGE_TYPE } from "../../src/runtime/runtime.js";
import { RUNTIME_ERROR } from "../../src/runtime/runtime-error.js";
import { MemoryStoragePort, FakeDerivedStatePort } from "../helpers/fakes.js";
import { FakeChromePermissionsApi } from "../helpers/fake-permissions.js";
import { createChromePermissionsAdapter } from "../../src/adapters/chrome-permissions.js";

const SITE_ID = "10000000-0000-4000-8000-000000000001";
const MUTATION_IDS = Array.from({ length: 20 }, (_, index) => `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);

function permissionPort(granted = []) {
  return createChromePermissionsAdapter(new FakeChromePermissionsApi({ granted }));
}

function setup(state = createDefaultState(), permissions = permissionPort(["https://example.com/*", "http://example.com/*", "https://www.example.com/*", "http://www.example.com/*"])) {
  const storage = new MemoryStoragePort(state);
  const derivedState = new FakeDerivedStatePort();
  let id = 0;
  const backend = createRuntimeBackend({ storage, derivedState, permissions, createMutationId: () => MUTATION_IDS[id++], createSiteId: () => SITE_ID });
  return { storage, derivedState, permissions, backend };
}

test("first runtime start initializes default state and derived state", async () => {
  const storage = new MemoryStoragePort(undefined);
  const derivedState = new FakeDerivedStatePort();
  const result = await initializeRuntime({ storage, derivedState });
  assert.equal(result.firstRun, true);
  assert.deepEqual(storage.rawState(), createDefaultState());
  assert.equal(derivedState.applyCalls.length, 1);
});

test("startup reconciles valid state and service-worker restart is idempotent", async () => {
  const { storage, derivedState } = setup();
  await initializeRuntime({ storage, derivedState });
  await initializeRuntime({ storage, derivedState });
  assert.equal(derivedState.applyCalls.length, 2);
});

test("startup finalizes a committed pending journal", async () => {
  const current = createDefaultState();
  const next = { ...configurationOf(current), revision: 1, enabled: false };
  const journal = createPendingMutation({ mutationId: MUTATION_IDS[0], operationKind: OPERATION_KIND.SET_ENABLED, currentState: current, nextState: next });
  const storage = new MemoryStoragePort(stateWithPending(next, journal));
  const derivedState = new FakeDerivedStatePort();
  await initializeRuntime({ storage, derivedState });
  assert.equal(storage.rawState().pendingMutation, null);
  assert.equal(storage.rawState().enabled, false);
});

for (const raw of [{ bad: true }, { ...createDefaultState(), schemaVersion: 99 }]) {
  test("unsafe startup preserves raw state and fails closed", async () => {
    const storage = new MemoryStoragePort(raw);
    const derivedState = new FakeDerivedStatePort();
    const result = await initializeRuntime({ storage, derivedState });
    assert.equal(result.recovery.action, "fail_closed");
    assert.deepEqual(storage.rawState(), raw);
    assert.equal(derivedState.failClosedCallsLog.length, 1);
  });
}

test("backend serializes create, profile, enabled, update, and delete", async () => {
  const { backend } = setup();
  let state = await backend.createSite({ expectedRevision: 0, site: { name: "Example", profile: PROFILE.DESKTOP, hosts: ["example.com"] } });
  state = await backend.setProfile({ expectedRevision: 1, siteId: SITE_ID, profile: PROFILE.MOBILE });
  state = await backend.setEnabled({ expectedRevision: 2, enabled: false });
  const edit = await backend.updateSite({ expectedRevision: 3, site: { siteId: SITE_ID, name: "Example", profile: PROFILE.MOBILE, hosts: ["example.com", "www.example.com"] } });
  assert.equal(edit.state.revision, 4);
  const removed = await backend.deleteSite({ expectedRevision: 4, siteId: SITE_ID });
  assert.equal(removed.state.revision, 5);
  assert.equal(removed.state.sites.length, 0);
  assert.equal(state.revision, 3);
});

test("create rejects missing permission without storage mutation", async () => {
  const permissions = permissionPort();
  const { backend, storage } = setup(createDefaultState(), permissions);
  await assert.rejects(() => backend.createSite({ expectedRevision: 0, site: { name: "Example", profile: PROFILE.DESKTOP, hosts: ["example.com"] } }), (error) => error.code === RUNTIME_ERROR.PERMISSION_REQUIRED);
  assert.equal(storage.rawState().revision, 0);
});

test("edit rejects an ungranted added host and preserves the existing Site", async () => {
  const permissions = permissionPort(["https://example.com/*", "http://example.com/*"]);
  const { backend, storage } = setup(createDefaultState(), permissions);
  await backend.createSite({ expectedRevision: 0, site: { name: "Example", profile: PROFILE.DESKTOP, hosts: ["example.com"] } });
  await assert.rejects(() => backend.updateSite({ expectedRevision: 1, site: { siteId: SITE_ID, name: "Example", profile: PROFILE.DESKTOP, hosts: ["example.com", "www.example.com"] } }), (error) => error.code === RUNTIME_ERROR.PERMISSION_REQUIRED);
  assert.equal(storage.rawState().revision, 1);
  assert.deepEqual(storage.rawState().sites[0].hosts, [{ hostname: "example.com", ruleId: 1 }]);
});

test("permission release failure is a warning and never resurrects a deleted Site", async () => {
  const api = new FakeChromePermissionsApi({ granted: ["https://example.com/*", "http://example.com/*"] });
  const permissions = createChromePermissionsAdapter(api);
  const { backend } = setup(createDefaultState(), permissions);
  await backend.createSite({ expectedRevision: 0, site: { name: "Example", profile: PROFILE.DESKTOP, hosts: ["example.com"] } });
  api.fail("remove");
  const result = await backend.deleteSite({ expectedRevision: 1, siteId: SITE_ID });
  assert.equal(result.state.sites.length, 0);
  assert.equal(result.permissionCleanup.warning, RUNTIME_ERROR.PERMISSION_CLEANUP_REQUIRED);
});

test("message boundary allows known commands and rejects malformed or injection commands", async () => {
  const { backend, derivedState } = setup();
  const handle = createRuntimeMessageHandler({ backend, derivedState });
  assert.equal((await handle({ type: MESSAGE_TYPE.GET_STATE })).ok, true);
  assert.equal((await handle(null)).error.code, RUNTIME_ERROR.INVALID_MESSAGE);
  assert.equal((await handle({ type: "set_user_agent", payload: { userAgent: "arbitrary" } })).error.code, RUNTIME_ERROR.UNKNOWN_COMMAND);
  assert.equal((await handle({ type: "update_dnr", payload: { addRules: [] } })).error.code, RUNTIME_ERROR.UNKNOWN_COMMAND);
  assert.equal((await handle({ type: MESSAGE_TYPE.CREATE_SITE, payload: { expectedRevision: 0, site: { name: "Injected", profile: PROFILE.DESKTOP, hosts: ["example.com"], userAgent: "arbitrary" } } })).error.code, RUNTIME_ERROR.INVALID_MESSAGE);
  assert.equal((await handle({ type: MESSAGE_TYPE.SET_ENABLED, payload: { expectedRevision: 0, enabled: false, addRules: [] } })).error.code, RUNTIME_ERROR.INVALID_MESSAGE);
});
