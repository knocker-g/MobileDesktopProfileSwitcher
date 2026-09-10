import test from "node:test";
import assert from "node:assert/strict";
import { createExtensionRuntime, registerRuntimeListeners } from "../../src/runtime/bootstrap.js";
import { MESSAGE_TYPE } from "../../src/runtime/runtime.js";
import { createDefaultState } from "../../src/core/storage-schema.js";
import { FakeChromeStorageArea } from "../helpers/fake-chrome-storage.js";
import { FakeDnrApi } from "../helpers/fake-dnr.js";
import { FakeChromePermissionsApi } from "../helpers/fake-permissions.js";

const SITE_ID = "10000000-0000-4000-8000-000000000001";
const MUTATION_ID = "20000000-0000-4000-8000-000000000001";

class Event {
  listeners = [];
  addListener(listener) { this.listeners.push(listener); }
}

function chromeFixture({ state = createDefaultState(), permissions = new FakeChromePermissionsApi(), reloadError = false } = {}) {
  const storage = new FakeChromeStorageArea({ mdpsState: state });
  const dnr = new FakeDnrApi();
  const events = [];
  const originalGet = storage.get.bind(storage);
  storage.get = async (...args) => { events.push("storage-read"); return originalGet(...args); };
  const originalRequest = permissions.request.bind(permissions);
  permissions.request = (details) => { events.push("permission-request"); return originalRequest(details); };
  const reloads = [];
  const chromeApi = {
    storage: { local: storage },
    permissions: { ...permissions, request: permissions.request.bind(permissions), contains: permissions.contains.bind(permissions), remove: permissions.remove.bind(permissions), onAdded: new Event(), onRemoved: new Event() },
    declarativeNetRequest: dnr,
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    tabs: {
      query: async () => [],
      get: async () => ({}),
      reload: async (tabId) => { reloads.push(tabId); if (reloadError) throw new Error("reload failed"); },
      onActivated: new Event(),
      onUpdated: new Event(),
    },
    runtime: { onInstalled: new Event(), onStartup: new Event(), onMessage: new Event() },
  };
  const runtime = createExtensionRuntime(chromeApi, { createMutationId: () => MUTATION_ID, createSiteId: () => SITE_ID });
  return { chromeApi, runtime, storage, dnr, permissions, events, reloads };
}

test("gesture Create requests permission before initialization and completes transaction", async () => {
  const fixture = chromeFixture();
  const operation = fixture.runtime.handleMessage({
    type: MESSAGE_TYPE.CREATE_SITE_WITH_PERMISSION,
    payload: { expectedRevision: 0, site: { name: "Example", profile: "desktop", hosts: ["example.com"] } },
  });
  assert.equal(fixture.events[0], "permission-request");
  assert.equal(fixture.events.includes("storage-read"), false, "storage must not be read before request starts");
  const response = await operation;
  assert.equal(response.ok, true);
  assert.equal(fixture.storage.data.mdpsState.sites[0].name, "Example");
  assert.equal(fixture.storage.data.mdpsState.pendingMutation, null);
  assert.equal(fixture.storage.data.mdpsState.revision, 1);
  assert.equal(fixture.dnr.rules.length, 1);
});

test("gesture Create denial and partial grant never initialize or mutate", async () => {
  for (const permissions of [
    new FakeChromePermissionsApi({ requestResult: false, grantRequested: false }),
    new FakeChromePermissionsApi({ requestResult: true, grantRequested: false, granted: ["https://example.com/*"] }),
  ]) {
    const fixture = chromeFixture({ permissions });
    const response = await fixture.runtime.handleMessage({
      type: MESSAGE_TYPE.CREATE_SITE_WITH_PERMISSION,
      payload: { expectedRevision: 0, site: { name: "Example", profile: "desktop", hosts: ["example.com"] } },
    });
    assert.equal(response.ok, false);
    assert.equal(fixture.storage.setCalls.length, 0);
    assert.equal(fixture.dnr.calls.length, 0);
    assert.equal(fixture.storage.data.mdpsState.sites.length, 0);
  }
});

test("gesture Create API rejection and stale revision never start a mutation", async () => {
  const failedApi = new FakeChromePermissionsApi();
  failedApi.fail("request");
  const rejected = chromeFixture({ permissions: failedApi });
  assert.equal((await rejected.runtime.handleMessage({
    type: MESSAGE_TYPE.CREATE_SITE_WITH_PERMISSION,
    payload: { expectedRevision: 0, site: { name: "Example", profile: "desktop", hosts: ["example.com"] } },
  })).ok, false);
  assert.equal(rejected.storage.setCalls.length, 0);

  const stale = chromeFixture();
  const response = await stale.runtime.handleMessage({
    type: MESSAGE_TYPE.CREATE_SITE_WITH_PERMISSION,
    payload: { expectedRevision: 9, site: { name: "Example", profile: "desktop", hosts: ["example.com"] } },
  });
  assert.equal(response.error.code, "stale_revision");
  assert.equal(stale.storage.data.mdpsState.sites.length, 0);
});

test("gesture Update verifies added-host hint against storage and preserves stable IDs", async () => {
  const state = {
    ...createDefaultState(), revision: 1, nextRuleId: 2,
    sites: [{ id: SITE_ID, name: "Example", profile: "desktop", hosts: [{ hostname: "example.com", ruleId: 1 }] }],
  };
  const permissions = new FakeChromePermissionsApi({ granted: ["https://example.com/*", "http://example.com/*"] });
  const fixture = chromeFixture({ state, permissions });
  const response = await fixture.runtime.handleMessage({
    type: MESSAGE_TYPE.UPDATE_SITE_WITH_PERMISSION,
    payload: {
      expectedRevision: 1,
      site: { siteId: SITE_ID, name: "Example 2", profile: "mobile", hosts: ["example.com", "m.example.com"] },
      addedHosts: ["m.example.com"],
    },
  });
  assert.equal(response.ok, true);
  assert.deepEqual(fixture.storage.data.mdpsState.sites[0].hosts, [
    { hostname: "example.com", ruleId: 1 }, { hostname: "m.example.com", ruleId: 2 },
  ]);

  const mismatch = chromeFixture({ state, permissions: new FakeChromePermissionsApi() });
  const bad = await mismatch.runtime.handleMessage({
    type: MESSAGE_TYPE.UPDATE_SITE_WITH_PERMISSION,
    payload: {
      expectedRevision: 1,
      site: { siteId: SITE_ID, name: "Example", profile: "desktop", hosts: ["example.com", "m.example.com"] },
      addedHosts: ["example.com"],
    },
  });
  assert.equal(bad.error.code, "invalid_message");
  assert.equal(mismatch.storage.data.mdpsState.revision, 1);
});

test("gesture Update denial preserves the Site while ordinary edits never request permission", async () => {
  const state = {
    ...createDefaultState(), revision: 1, nextRuleId: 3,
    sites: [{
      id: SITE_ID, name: "Example", profile: "desktop",
      hosts: [{ hostname: "example.com", ruleId: 1 }, { hostname: "old.example.com", ruleId: 2 }],
    }],
  };
  const deniedPermissions = new FakeChromePermissionsApi({
    requestResult: false,
    grantRequested: false,
    granted: [
      "https://example.com/*", "http://example.com/*",
      "https://old.example.com/*", "http://old.example.com/*",
    ],
  });
  const denied = chromeFixture({ state, permissions: deniedPermissions });
  const deniedResponse = await denied.runtime.handleMessage({
    type: MESSAGE_TYPE.UPDATE_SITE_WITH_PERMISSION,
    payload: {
      expectedRevision: 1,
      site: { siteId: SITE_ID, name: "Changed", profile: "mobile", hosts: ["example.com", "new.example.com"] },
      addedHosts: ["new.example.com"],
    },
  });
  assert.equal(deniedResponse.error.code, "permission_denied");
  assert.deepEqual(denied.storage.data.mdpsState, state);

  const ordinaryPermissions = new FakeChromePermissionsApi({
    granted: [
      "https://example.com/*", "http://example.com/*",
      "https://old.example.com/*", "http://old.example.com/*",
    ],
  });
  const ordinary = chromeFixture({ state, permissions: ordinaryPermissions });
  const response = await ordinary.runtime.handleMessage({
    type: MESSAGE_TYPE.UPDATE_SITE,
    payload: {
      expectedRevision: 1,
      site: { siteId: SITE_ID, name: "Renamed", profile: "mobile", hosts: ["example.com"] },
    },
  });
  assert.equal(response.ok, true);
  assert.equal(ordinaryPermissions.calls.some((call) => call.operation === "request"), false);
  assert.equal(ordinary.storage.data.mdpsState.sites[0].name, "Renamed");
  assert.deepEqual(ordinary.storage.data.mdpsState.sites[0].hosts, [{ hostname: "example.com", ruleId: 1 }]);
});

test("Grant validates stored Site, reconciles, and treats reload failure as a warning", async () => {
  const state = {
    ...createDefaultState(), revision: 1, nextRuleId: 2,
    sites: [{ id: SITE_ID, name: "Example", profile: "desktop", hosts: [{ hostname: "example.com", ruleId: 1 }] }],
  };
  const fixture = chromeFixture({ state, reloadError: true });
  const response = await fixture.runtime.handleMessage({
    type: MESSAGE_TYPE.GRANT_SITE_ACCESS,
    payload: { expectedRevision: 1, siteId: SITE_ID, hosts: ["example.com"], currentTabId: 42 },
  });
  assert.equal(response.ok, true);
  assert.equal(response.value.warning, "reload_failed");
  assert.deepEqual(fixture.reloads, [42]);
  assert.equal(fixture.dnr.rules.length, 1);
  assert.equal(fixture.storage.data.mdpsState.revision, 1);
});

test("message receiver disappearance does not cancel the already-started operation", async () => {
  const chromeApi = {
    runtime: { onInstalled: new Event(), onStartup: new Event(), onMessage: new Event() },
    permissions: { onAdded: new Event(), onRemoved: new Event() },
    tabs: { onActivated: new Event(), onUpdated: new Event() },
  };
  let completed = false;
  const runtime = {
    initialize: async () => {}, reconcile: async () => {}, derivedState: {}, badges: { refreshTab: async () => {} },
    handleMessage() { return Promise.resolve().then(() => { completed = true; return { ok: true }; }); },
  };
  registerRuntimeListeners(chromeApi, runtime);
  const returned = chromeApi.runtime.onMessage.listeners[0]({}, {}, () => { throw new Error("receiver closed"); });
  assert.equal(returned, true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(completed, true);
});
