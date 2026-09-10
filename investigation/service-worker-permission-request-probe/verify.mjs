import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFile(join(root, name), "utf8");
const [manifestText, popup, worker, html] = await Promise.all([
  read("manifest.json"), read("popup.js"), read("service-worker.js"), read("popup.html"),
]);
const manifest = JSON.parse(manifestText);

assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, []);
assert.deepEqual(manifest.optional_host_permissions, ["https://example.com/*"]);
assert.equal(manifest.action.default_popup, "popup.html");
assert.equal(manifest.background.service_worker, "service-worker.js");
assert.doesNotMatch(popup, /permissions\.request/);
assert.match(popup, /addEventListener\("click", \(\) => \{[\s\S]*?runtime\.sendMessage\(\{ type: "REQUEST_PERMISSION_FROM_SW" \}\)/);
assert.match(worker, /const ORIGIN = "https:\/\/example\.com\/\*"/);
assert.match(worker, /function requestFromServiceWorker\(\) \{[\s\S]*?chrome\.permissions\.request/);
const beforeRequest = worker.match(/function requestFromServiceWorker\(\) \{([\s\S]*?)chrome\.permissions\.request/)?.[1] ?? "";
assert.doesNotMatch(beforeRequest, /\bawait\b/);
assert.match(worker, /permissions\.contains/);
assert.match(worker, /setBadgeText\(\{ text: "OK" \}\)/);
assert.match(html, /Request from Service Worker/);
assert.match(html, /Check permission/);
assert.match(html, /Remove permission/);
for (const forbidden of ["tabs", "scripting", "webRequest", "debugger", "content_scripts", "declarativeNetRequest"]) {
  assert.equal(manifestText.includes(forbidden), false, `Forbidden capability found: ${forbidden}`);
}

console.log("SERVICE WORKER PERMISSION REQUEST PROBE STATIC CHECK PASS");
