import test from "node:test";
import assert from "node:assert/strict";
import { requestExactHostAccess } from "../../src/ui/popup-actions.js";
import { createHostPermissionInspection } from "../../src/core/permissions.js";

test("permission request is the first asynchronous effect and uses exact HTTP/HTTPS origins", async () => {
  const calls = [];
  const port = {
    requestOrigins(origins) { calls.push(["request", origins]); return Promise.resolve(true); },
    async inspectHosts(hosts) { calls.push(["inspect", hosts]); return hosts.map((hostname) => createHostPermissionInspection(hostname, { https: true, http: true })); },
  };
  const pending = requestExactHostAccess(["www.youtube.com"], port);
  assert.equal(calls[0][0], "request");
  assert.deepEqual(calls[0][1], ["https://www.youtube.com/*", "http://www.youtube.com/*"]);
  assert.equal(await pending, true);
  assert.deepEqual(calls.map((call) => call[0]), ["request", "inspect"]);
});

test("denied or incomplete permission never reports ready", async () => {
  const denied = { requestOrigins: () => Promise.resolve(false), inspectHosts: async () => [createHostPermissionInspection("example.com", { https: false, http: false })] };
  assert.equal(await requestExactHostAccess(["example.com"], denied), false);
  const partial = { requestOrigins: () => Promise.resolve(true), inspectHosts: async () => [createHostPermissionInspection("example.com", { https: true, http: false })] };
  assert.equal(await requestExactHostAccess(["example.com"], partial), false);
});

test("no added host performs no permission API call", async () => {
  let called = false;
  assert.equal(await requestExactHostAccess([], { requestOrigins() { called = true; } }), true);
  assert.equal(called, false);
});

test("two-host Save permission plan requests both exact hosts in one user action", async () => {
  const calls = [];
  const hosts = ["www.youtube.com", "m.youtube.com"];
  const port = {
    requestOrigins(origins) { calls.push(origins); return Promise.resolve(true); },
    async inspectHosts(inspected) {
      return inspected.map((hostname) => createHostPermissionInspection(hostname, { https: true, http: true }));
    },
  };
  assert.equal(await requestExactHostAccess(hosts, port), true);
  assert.deepEqual(calls, [[
    "https://www.youtube.com/*",
    "http://www.youtube.com/*",
    "https://m.youtube.com/*",
    "http://m.youtube.com/*",
  ]]);
});
