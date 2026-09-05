import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(
  await readFile(new URL("../../manifest.json", import.meta.url), "utf8"),
);

test("product manifest is MV3 with the exact Phase 1 API permissions", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, [
    "storage",
    "declarativeNetRequestWithHostAccess",
    "activeTab",
  ]);
  assert.equal(Object.hasOwn(manifest, "host_permissions"), false);
});

test("optional host permissions are only the designed HTTP(S) capability envelope", () => {
  assert.deepEqual(manifest.optional_host_permissions, [
    "http://*/*",
    "https://*/*",
  ]);
});

test("Phase 1 does not expose unfinished extension entry points", () => {
  for (const key of [
    "action",
    "background",
    "content_scripts",
    "declarative_net_request",
    "options_page",
    "options_ui",
  ]) {
    assert.equal(Object.hasOwn(manifest, key), false, `${key} must be absent`);
  }
});
