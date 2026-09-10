import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createCwsZip,
  defaultOutputPath,
  inspectCwsZip,
  loadCwsAllowlist,
  repositoryRoot,
  verifyCwsZip,
} from "../../scripts/package-cws.mjs";

const REQUIRED_PACKAGE_FILES = Object.freeze([
  "LICENSE",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png",
  "manifest.json",
  "src/service-worker.js",
  "src/ui/popup.html",
  "src/ui/popup.css",
  "src/ui/popup.js",
]);

const importPattern = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']/g;

async function productionDependencyClosure() {
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "manifest.json"), "utf8"));
  const roots = [manifest.background.service_worker, manifest.action.default_popup];
  const popup = await readFile(path.join(repositoryRoot, manifest.action.default_popup), "utf8");
  for (const match of popup.matchAll(/(?:src|href)="([^"]+)"/g)) {
    roots.push(path.posix.join(path.posix.dirname(manifest.action.default_popup), match[1]));
  }
  roots.push(...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon));

  const closure = new Set(["manifest.json", "LICENSE"]);
  const pending = [...roots];
  while (pending.length > 0) {
    const file = pending.pop();
    if (closure.has(file)) continue;
    closure.add(file);
    if (!file.endsWith(".js")) continue;
    const source = await readFile(path.join(repositoryRoot, ...file.split("/")), "utf8");
    for (const match of source.matchAll(importPattern)) {
      pending.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1])));
    }
  }
  return [...closure].sort();
}

test("CWS allowlist is the exact production dependency closure", async () => {
  const allowlist = await loadCwsAllowlist();
  assert.deepEqual(allowlist, await productionDependencyClosure());
  for (const required of REQUIRED_PACKAGE_FILES) assert.ok(allowlist.includes(required), required);
  assert.ok(!allowlist.some((file) => /(^|\/)(?:test|scripts|investigation|assets|docs)(\/|$)/.test(file)));
  assert.ok(!allowlist.some((file) => /(?:README|PRIVACY|package(?:-lock)?)\b/.test(file)));
});

test("generated CWS ZIP exactly matches the allowlist and passes content validation", async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "mdps-cws-test-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const outputPath = path.join(temporary, "candidate.zip");
  const archive = await createCwsZip({ outputPath });
  const writtenArchive = await readFile(outputPath);
  const { entries, manifest } = await verifyCwsZip(writtenArchive);
  assert.deepEqual(entries.map(({ name }) => name), await loadCwsAllowlist());
  assert.equal(manifest.version, "1.0.1");
  assert.equal(writtenArchive.compare(archive), 0);
});

test("CWS ZIP generation is byte-identical and contains safe normalized paths", async () => {
  const first = await createCwsZip();
  const second = await createCwsZip();
  assert.equal(first.compare(second), 0);
  for (const { name } of inspectCwsZip(first)) {
    assert.ok(!name.includes("\\"));
    assert.ok(!name.startsWith("/"));
    assert.ok(!name.split("/").includes(".."));
  }
  assert.match((await defaultOutputPath()).replaceAll("\\", "/"), /\/dist\/mobile-desktop-profile-switcher-v1\.0\.1\.zip$/);
});
