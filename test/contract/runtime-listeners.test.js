import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerRuntimeListeners } from "../../src/runtime/bootstrap.js";

const bootstrapSource = await readFile(new URL("../../src/runtime/bootstrap.js", import.meta.url), "utf8");

class Event {
  listeners = [];
  addListener(listener) { this.listeners.push(listener); }
  emit(...args) { return this.listeners.map((listener) => listener(...args)); }
}

function fakeChromeEvents() {
  return {
    runtime: { onInstalled: new Event(), onStartup: new Event(), onMessage: new Event() },
    permissions: { onRemoved: new Event(), onAdded: new Event() },
    tabs: { onActivated: new Event(), onUpdated: new Event() },
  };
}

test("runtime listeners are registered synchronously at service-worker top level", () => {
  const chromeApi = fakeChromeEvents();
  const runtime = { initialize: async () => {}, reconcile: async () => {}, handleMessage: async () => ({ ok: true }), backend: {}, derivedState: {}, badges: { refreshTab: async () => {} } };
  registerRuntimeListeners(chromeApi, runtime);
  assert.equal(chromeApi.runtime.onInstalled.listeners.length, 1);
  assert.equal(chromeApi.runtime.onStartup.listeners.length, 1);
  assert.equal(chromeApi.runtime.onMessage.listeners.length, 1);
  assert.equal(chromeApi.permissions.onRemoved.listeners.length, 1);
  assert.equal(chromeApi.permissions.onAdded.listeners.length, 1);
  assert.equal(chromeApi.tabs.onActivated.listeners.length, 1);
  assert.equal(chromeApi.tabs.onUpdated.listeners.length, 1);
});

test("startup and install share one initialization path", async () => {
  const chromeApi = fakeChromeEvents();
  let calls = 0;
  const runtime = { initialize: async () => { calls += 1; }, reconcile: async () => {}, handleMessage: async () => ({}), backend: {}, derivedState: {}, badges: { refreshTab: async () => {} } };
  registerRuntimeListeners(chromeApi, runtime);
  await Promise.all([...chromeApi.runtime.onInstalled.emit(), ...chromeApi.runtime.onStartup.emit()]);
  assert.equal(calls, 2);
});

test("permission removal reconciles stored state without requesting permission", async () => {
  const chromeApi = fakeChromeEvents();
  const calls = [];
  const runtime = {
    initialize: async () => {},
    handleMessage: async () => ({}),
    reconcile: async () => { calls.push("reconcile"); },
    backend: {},
    derivedState: {
      failClosed: async () => { calls.push("failClosed"); },
    },
    badges: { refreshTab: async () => {} },
  };
  registerRuntimeListeners(chromeApi, runtime);
  await Promise.all(chromeApi.permissions.onRemoved.emit({ origins: ["https://example.com/*"] }));
  assert.deepEqual(calls, ["reconcile"]);
});

test("message listener keeps channel open and returns structured response", async () => {
  const chromeApi = fakeChromeEvents();
  const runtime = { initialize: async () => {}, reconcile: async () => {}, handleMessage: async () => ({ ok: true }), backend: {}, derivedState: {}, badges: { refreshTab: async () => {} } };
  registerRuntimeListeners(chromeApi, runtime);
  const responses = [];
  const returned = chromeApi.runtime.onMessage.listeners[0]({ type: "get_state" }, {}, (value) => responses.push(value));
  assert.equal(returned, true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(responses, [{ ok: true }]);
});

test("tab and permission events refresh badge and reconcile without tabs permission", async () => {
  const chromeApi = fakeChromeEvents();
  const calls = [];
  const runtime = {
    initialize: async () => { calls.push(["initialize"]); },
    reconcile: async () => { calls.push(["reconcile"]); },
    handleMessage: async () => ({ ok: true }),
    derivedState: {},
    badges: { refreshTab: async (tabId, url) => calls.push(["badge", tabId, url]) },
  };
  registerRuntimeListeners(chromeApi, runtime);
  await Promise.all(chromeApi.tabs.onActivated.emit({ tabId: 4, windowId: 1 }));
  await Promise.all(chromeApi.tabs.onUpdated.emit(4, { status: "complete", url: "https://example.com" }, { id: 4 }));
  await Promise.all(chromeApi.permissions.onAdded.emit({ origins: ["https://example.com/*"] }));
  assert.deepEqual(calls, [
    ["initialize"],
    ["badge", 4, undefined],
    ["initialize"],
    ["badge", 4, "https://example.com"],
    ["reconcile"],
  ]);
});

test("service-worker entry registers listeners without eager initialization", async () => {
  const source = await readFile(new URL("../../src/service-worker.js", import.meta.url), "utf8");
  assert.match(source, /registerRuntimeListeners\(chrome, runtime\)/);
  assert.doesNotMatch(source, /runtime\.initialize\(\)/);
});

test("successful mutations refresh all tab badges while read-only messages do not", () => {
  assert.match(bootstrapSource, /response\.ok && !\["get_state", "inspect_permissions"\]\.includes\(message\?\.type\)/);
  assert.match(bootstrapSource, /await refreshBadges\(\)/);
});
