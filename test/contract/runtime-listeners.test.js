import test from "node:test";
import assert from "node:assert/strict";
import { registerRuntimeListeners } from "../../src/runtime/bootstrap.js";

class Event {
  listeners = [];
  addListener(listener) { this.listeners.push(listener); }
  emit(...args) { return this.listeners.map((listener) => listener(...args)); }
}

function fakeChromeEvents() {
  return {
    runtime: { onInstalled: new Event(), onStartup: new Event(), onMessage: new Event() },
    permissions: { onRemoved: new Event() },
  };
}

test("runtime listeners are registered synchronously at service-worker top level", () => {
  const chromeApi = fakeChromeEvents();
  const runtime = { initialize: async () => {}, reconcile: async () => {}, handleMessage: async () => ({ ok: true }), backend: {}, derivedState: {} };
  registerRuntimeListeners(chromeApi, runtime);
  assert.equal(chromeApi.runtime.onInstalled.listeners.length, 1);
  assert.equal(chromeApi.runtime.onStartup.listeners.length, 1);
  assert.equal(chromeApi.runtime.onMessage.listeners.length, 1);
  assert.equal(chromeApi.permissions.onRemoved.listeners.length, 1);
});

test("startup and install share one initialization path", async () => {
  const chromeApi = fakeChromeEvents();
  let calls = 0;
  const runtime = { initialize: async () => { calls += 1; }, reconcile: async () => {}, handleMessage: async () => ({}), backend: {}, derivedState: {} };
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
  };
  registerRuntimeListeners(chromeApi, runtime);
  await Promise.all(chromeApi.permissions.onRemoved.emit({ origins: ["https://example.com/*"] }));
  assert.deepEqual(calls, ["reconcile"]);
});

test("message listener keeps channel open and returns structured response", async () => {
  const chromeApi = fakeChromeEvents();
  const runtime = { initialize: async () => {}, reconcile: async () => {}, handleMessage: async () => ({ ok: true }), backend: {}, derivedState: {} };
  registerRuntimeListeners(chromeApi, runtime);
  const responses = [];
  const returned = chromeApi.runtime.onMessage.listeners[0]({ type: "get_state" }, {}, (value) => responses.push(value));
  assert.equal(returned, true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(responses, [{ ok: true }]);
});
