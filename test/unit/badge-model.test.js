import test from "node:test";
import assert from "node:assert/strict";
import { badgeTextForTab, BADGE_TEXT } from "../../src/ui/badge-model.js";
import { createDefaultState } from "../../src/core/storage-schema.js";

const SITE = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Example",
  profile: "desktop",
  hosts: [{ hostname: "www.example.com", ruleId: 1 }, { hostname: "m.example.com", ruleId: 2 }],
};
const granted = SITE.hosts.map(({ hostname }) => ({ hostname, fullyGranted: true }));
const state = (overrides = {}) => ({ ...createDefaultState(), sites: [SITE], nextRuleId: 3, ...overrides });

test("badge maps actual per-tab profile state without relying on color", () => {
  assert.equal(badgeTextForTab(state(), "https://www.example.com/path", granted), BADGE_TEXT.DESKTOP);
  assert.equal(badgeTextForTab(state({ sites: [{ ...SITE, profile: "mobile" }] }), "https://m.example.com", granted), BADGE_TEXT.MOBILE);
  assert.equal(badgeTextForTab(state({ sites: [{ ...SITE, profile: "default" }] }), "https://www.example.com", granted), BADGE_TEXT.DEFAULT);
  assert.equal(badgeTextForTab(state({ enabled: false }), "https://unregistered.example", []), BADGE_TEXT.OFF);
  assert.equal(badgeTextForTab(state(), "https://unregistered.example", granted), BADGE_TEXT.NONE);
});

test("missing or partial Site access reports no active override", () => {
  assert.equal(badgeTextForTab(state(), "https://www.example.com", [{ hostname: "www.example.com", fullyGranted: false }]), BADGE_TEXT.DEFAULT);
  assert.equal(badgeTextForTab(state(), "https://www.example.com", [granted[0]]), BADGE_TEXT.DESKTOP);
  assert.equal(badgeTextForTab(state(), "chrome://extensions", granted), BADGE_TEXT.NONE);
});
