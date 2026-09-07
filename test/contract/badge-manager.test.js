import test from "node:test";
import assert from "node:assert/strict";
import { createBadgeManager } from "../../src/runtime/badge-manager.js";
import { createDefaultState } from "../../src/core/storage-schema.js";

const site = { id: "10000000-0000-4000-8000-000000000001", name: "Example", profile: "desktop", hosts: [{ hostname: "example.com", ruleId: 1 }] };

test("badge manager refreshes registered and unregistered tabs without tabs permission data", async () => {
  const values = [];
  const manager = createBadgeManager({
    tabs: { query: async () => [{ id: 1, url: "https://example.com" }, { id: 2 }] },
    badge: { set: async (tabId, text) => values.push([tabId, text]) },
    backend: {
      getState: async () => ({ ...createDefaultState(), sites: [site], nextRuleId: 2 }),
      inspectPermissions: async () => [{ hostname: "example.com", fullyGranted: true }],
    },
  });
  await manager.refreshAll();
  assert.deepEqual(values, [[1, "D"], [2, ""]]);
});

test("badge manager resolves an activated tab URL when Chrome exposes it", async () => {
  const values = [];
  const manager = createBadgeManager({
    tabs: { query: async () => [], get: async () => ({ url: "https://example.com/path" }) },
    badge: { set: async (tabId, text) => values.push([tabId, text]) },
    backend: {
      getState: async () => ({ ...createDefaultState(), sites: [site], nextRuleId: 2 }),
      inspectPermissions: async () => [{ hostname: "example.com", fullyGranted: true }],
    },
  });
  await manager.refreshTab(9);
  assert.deepEqual(values, [[9, "D"]]);
});
