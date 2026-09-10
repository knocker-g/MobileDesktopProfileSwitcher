import test from "node:test";
import assert from "node:assert/strict";
import { startGestureSensitivePermissionCommand } from "../../src/runtime/permission-commands.js";
import { MESSAGE_TYPE } from "../../src/runtime/runtime.js";
import { createHostPermissionInspection } from "../../src/core/permissions.js";
import { PERMISSION_ERROR } from "../../src/core/permission-error.js";

const SITE_ID = "10000000-0000-4000-8000-000000000001";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function port({ requestResult = true, grants = true } = {}) {
  const calls = [];
  return {
    calls,
    requestOrigins(origins) { calls.push(["request", origins]); return Promise.resolve(requestResult); },
    async inspectHosts(hosts) {
      calls.push(["inspect", hosts]);
      return hosts.map((hostname, index) => createHostPermissionInspection(hostname, {
        https: typeof grants === "function" ? grants(hostname, index).https : grants,
        http: typeof grants === "function" ? grants(hostname, index).http : grants,
      }));
    },
  };
}

test("Create starts exact permission request synchronously for every candidate host", async () => {
  const gate = deferred();
  const calls = [];
  const permissions = {
    requestOrigins(origins) { calls.push(["request", origins]); return gate.promise; },
    async inspectHosts(hosts) { calls.push(["inspect", hosts]); return hosts.map((hostname) => createHostPermissionInspection(hostname, { https: true, http: true })); },
  };
  const operation = startGestureSensitivePermissionCommand({
    type: MESSAGE_TYPE.CREATE_SITE_WITH_PERMISSION,
    payload: { expectedRevision: 0, site: { name: "Video", profile: "mobile", hosts: ["www.example.com", "m.example.com"] } },
  }, permissions);
  assert.deepEqual(calls, [["request", [
    "https://www.example.com/*", "http://www.example.com/*",
    "https://m.example.com/*", "http://m.example.com/*",
  ]]]);
  gate.resolve(true);
  const prepared = await operation;
  assert.equal(prepared.type, MESSAGE_TYPE.CREATE_SITE_WITH_PERMISSION);
  assert.deepEqual(calls.map(([kind]) => kind), ["request", "inspect"]);
});

test("malformed, wildcard, URL, and unrelated update hints never reach permission API", () => {
  const permissions = { requestOrigins() { assert.fail("permission request must not run"); } };
  for (const message of [
    { type: MESSAGE_TYPE.CREATE_SITE_WITH_PERMISSION, payload: { expectedRevision: 0, site: { name: "Bad", profile: "desktop", hosts: ["*.example.com"] } } },
    { type: MESSAGE_TYPE.CREATE_SITE_WITH_PERMISSION, payload: { expectedRevision: 0, site: { name: "Bad", profile: "desktop", hosts: ["https://example.com/path"] } } },
    { type: MESSAGE_TYPE.UPDATE_SITE_WITH_PERMISSION, payload: { expectedRevision: 1, site: { siteId: SITE_ID, name: "Bad", profile: "desktop", hosts: ["example.com"] }, addedHosts: ["other.example.com"] } },
  ]) assert.throws(() => startGestureSensitivePermissionCommand(message, permissions));
});

test("denial and incomplete post-condition expose stable permission errors", async () => {
  const denied = port({ requestResult: false, grants: false });
  await assert.rejects(() => startGestureSensitivePermissionCommand({
    type: MESSAGE_TYPE.CREATE_SITE_WITH_PERMISSION,
    payload: { expectedRevision: 0, site: { name: "Example", profile: "desktop", hosts: ["example.com"] } },
  }, denied), (error) => error.code === PERMISSION_ERROR.DENIED);

  const partial = port({ grants: () => ({ https: true, http: false }) });
  await assert.rejects(() => startGestureSensitivePermissionCommand({
    type: MESSAGE_TYPE.UPDATE_SITE_WITH_PERMISSION,
    payload: { expectedRevision: 1, site: { siteId: SITE_ID, name: "Example", profile: "desktop", hosts: ["example.com", "m.example.com"] }, addedHosts: ["m.example.com"] },
  }, partial), (error) => error.code === PERMISSION_ERROR.POST_CONDITION_FAILURE);
});

test("non-gesture commands are ignored without any permission effect", () => {
  let called = false;
  assert.equal(startGestureSensitivePermissionCommand({ type: MESSAGE_TYPE.GET_STATE }, { requestOrigins() { called = true; } }), null);
  assert.equal(called, false);
});
