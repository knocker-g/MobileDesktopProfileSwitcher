import test from "node:test";
import assert from "node:assert/strict";
import { createActiveTabAdapter } from "../../src/adapters/active-tab.js";

test("activeTab adapter queries only active current-window tab and returns URL", async () => {
  const calls = [];
  const adapter = createActiveTabAdapter({ query: async (query) => { calls.push(query); return [{ url: "https://example.com/private?q=x" }]; } });
  assert.equal(await adapter.getCurrentUrl(), "https://example.com/private?q=x");
  assert.deepEqual(calls, [{ active: true, currentWindow: true }]);
});

test("activeTab adapter safely handles absent URL", async () => {
  assert.equal(await createActiveTabAdapter({ query: async () => [{}] }).getCurrentUrl(), null);
  assert.equal(await createActiveTabAdapter({ query: async () => [] }).getCurrentUrl(), null);
});

test("activeTab adapter returns only current tab id and URL for popup status", async () => {
  const adapter = createActiveTabAdapter({ query: async () => [{ id: 42, url: "https://example.com/path", title: "Private title" }] });
  assert.deepEqual(await adapter.getCurrentTab(), { id: 42, url: "https://example.com/path" });
});
