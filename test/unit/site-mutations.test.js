import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultState } from "../../src/core/storage-schema.js";
import { PROFILE } from "../../src/core/profiles.js";
import { createSiteMutation, deleteSiteMutation, setEnabledMutation, setProfileMutation, updateSiteMutation } from "../../src/runtime/site-mutations.js";

const ID = "10000000-0000-4000-8000-000000000001";

function siteState() {
  return createSiteMutation(createDefaultState(), {
    name: "Example", profile: PROFILE.DESKTOP, hosts: ["EXAMPLE.com."],
  }, () => ID);
}

test("Site creation assigns backend ID and stable rule ID", () => {
  const state = siteState();
  assert.equal(state.sites[0].id, ID);
  assert.deepEqual(state.sites[0].hosts, [{ hostname: "example.com", ruleId: 1 }]);
  assert.equal(state.nextRuleId, 2);
});

test("Site edit preserves an existing ID and allocates only added host", () => {
  const state = siteState();
  const next = updateSiteMutation(state, { siteId: ID, name: "Changed", profile: PROFILE.MOBILE, hosts: ["example.com", "www.example.com"] });
  assert.deepEqual(next.sites[0].hosts, [{ hostname: "example.com", ruleId: 1 }, { hostname: "www.example.com", ruleId: 2 }]);
  assert.equal(next.nextRuleId, 3);
});

test("profile, enabled, and delete mutations retain immutable input", () => {
  const state = siteState();
  assert.equal(setProfileMutation(state, ID, PROFILE.DEFAULT).sites[0].profile, PROFILE.DEFAULT);
  assert.equal(setEnabledMutation(state, false).enabled, false);
  assert.deepEqual(deleteSiteMutation(state, ID).sites, []);
  assert.equal(state.sites.length, 1);
});
