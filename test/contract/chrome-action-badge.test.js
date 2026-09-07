import test from "node:test";
import assert from "node:assert/strict";
import { createChromeActionBadgeAdapter } from "../../src/adapters/chrome-action-badge.js";

test("action badge adapter sets visible text per tab without extra capability", async () => {
  const calls = [];
  const adapter = createChromeActionBadgeAdapter({
    async setBadgeText(details) { calls.push(["text", details]); },
    async setBadgeBackgroundColor(details) { calls.push(["color", details]); },
  });
  await adapter.set(7, "D");
  await adapter.set(7, "");
  assert.deepEqual(calls[0], ["text", { tabId: 7, text: "D" }]);
  assert.equal(calls[1][0], "color");
  assert.deepEqual(calls[2], ["text", { tabId: 7, text: "" }]);
});
