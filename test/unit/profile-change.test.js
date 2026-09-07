import test from "node:test";
import assert from "node:assert/strict";
import { applyCurrentSiteProfile } from "../../src/ui/profile-change.js";

function harness({ commitError = null, reloadError = null } = {}) {
  const calls = [];
  return {
    calls,
    options(profile) {
      return {
        siteId: "site-1",
        profile,
        expectedRevision: 7,
        tabId: 42,
        commitProfile: async (payload) => {
          calls.push(["commit", payload]);
          if (commitError) throw commitError;
        },
        refreshState: async () => calls.push(["refresh"]),
        reloadTab: async (tabId) => {
          calls.push(["reload", tabId]);
          if (reloadError) throw reloadError;
        },
      };
    },
  };
}

for (const [from, profile] of [
  ["default", "desktop"],
  ["default", "mobile"],
  ["desktop", "default"],
  ["desktop", "mobile"],
  ["mobile", "default"],
  ["mobile", "desktop"],
]) {
  test(`current Site ${from} to ${profile} commits, refreshes, then reloads only its tab`, async () => {
    const fixture = harness();
    const result = await applyCurrentSiteProfile(fixture.options(profile));
    assert.deepEqual(fixture.calls, [
      ["commit", { expectedRevision: 7, siteId: "site-1", profile }],
      ["refresh"],
      ["reload", 42],
    ]);
    assert.deepEqual(result, { committed: true, reloaded: true, warning: null });
  });
}

test("mutation or DNR reconcile failure prevents refresh and reload", async () => {
  const fixture = harness({ commitError: new Error("derived apply failed") });
  await assert.rejects(() => applyCurrentSiteProfile(fixture.options("mobile")), /derived apply failed/);
  assert.deepEqual(fixture.calls.map(([kind]) => kind), ["commit"]);
});

test("reload failure does not roll back a committed Profile", async () => {
  const fixture = harness({ reloadError: new Error("tab closed") });
  const result = await applyCurrentSiteProfile(fixture.options("desktop"));
  assert.deepEqual(fixture.calls.map(([kind]) => kind), ["commit", "refresh", "reload"]);
  assert.deepEqual(result, { committed: true, reloaded: false, warning: "reload_failed" });
});

test("refresh failure after commit does not roll back or reload stale UI state", async () => {
  const fixture = harness();
  const options = { ...fixture.options("mobile"), refreshState: async () => { fixture.calls.push(["refresh"]); throw new Error("popup closed"); } };
  const result = await applyCurrentSiteProfile(options);
  assert.deepEqual(fixture.calls.map(([kind]) => kind), ["commit", "refresh"]);
  assert.deepEqual(result, { committed: true, reloaded: false, warning: "refresh_failed" });
});

test("missing current tab skips reload after a successful mutation", async () => {
  const fixture = harness();
  const options = { ...fixture.options("default"), tabId: null };
  const result = await applyCurrentSiteProfile(options);
  assert.deepEqual(fixture.calls.map(([kind]) => kind), ["commit", "refresh"]);
  assert.equal(result.warning, "reload_unavailable");
});
