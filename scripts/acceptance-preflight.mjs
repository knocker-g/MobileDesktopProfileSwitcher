import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createHostPermissionInspection, exactOriginsForHost } from "../src/core/permissions.js";
import { PROFILE, VERIFIED_PROFILE_SET } from "../src/core/profiles.js";
import { createDefaultState } from "../src/core/storage-schema.js";
import { generateExpectedRules, matchesExactHostScope } from "../src/core/dnr-rules.js";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

async function filesBelow(relative) {
  const directory = path.join(ROOT, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(child));
    else files.push(child);
  }
  return files;
}

function assertion(condition, message) {
  if (!condition) throw new Error(message);
}

function check(name, action) {
  return Promise.resolve().then(action).then(() => Object.freeze({ name, status: "PASS" }));
}

export async function runAcceptancePreflight() {
  const manifest = JSON.parse(await readFile(path.join(ROOT, "manifest.json"), "utf8"));
  const packageJson = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  const sourceFiles = (await filesBelow("src")).filter((file) => /\.(?:js|html|css)$/.test(file));
  const sources = await Promise.all(sourceFiles.map((file) => readFile(path.join(ROOT, file), "utf8")));
  const productText = sources.join("\n");
  const popupHtml = await readFile(path.join(ROOT, "src/ui/popup.html"), "utf8");

  const fixtureState = {
    ...createDefaultState(),
    nextRuleId: 2,
    sites: [{
      id: "10000000-0000-4000-8000-000000000001",
      name: "Acceptance Fixture",
      profile: PROFILE.DESKTOP,
      hosts: [{ hostname: "acceptance.example", ruleId: 1 }],
    }],
  };
  const fixturePermission = createHostPermissionInspection("acceptance.example", { https: true, http: true });
  const fixtureRules = generateExpectedRules(fixtureState, [fixturePermission]).rules;

  const checks = [
    check("Manifest V3 and product identity", () => {
      assertion(manifest.manifest_version === 3, "Manifest must be V3");
      assertion(manifest.name === "MobileDesktopProfileSwitcher", "Unexpected product name");
    }),
    check("Popup and service-worker assets", async () => {
      assertion(manifest.action?.default_popup === "src/ui/popup.html", "Popup entry mismatch");
      assertion(manifest.background?.service_worker === "src/service-worker.js", "Worker entry mismatch");
      await Promise.all([access(path.join(ROOT, manifest.action.default_popup)), access(path.join(ROOT, manifest.background.service_worker))]);
    }),
    check("Required permission allowlist", () => {
      assertion(JSON.stringify(manifest.permissions) === JSON.stringify(["storage", "declarativeNetRequestWithHostAccess", "activeTab"]), "Required permissions changed");
      assertion(!Object.hasOwn(manifest, "host_permissions"), "Install-time host permission is forbidden");
    }),
    check("Optional host capability envelope", () => {
      assertion(JSON.stringify(manifest.optional_host_permissions) === JSON.stringify(["http://*/*", "https://*/*"]), "Optional host envelope changed");
      assertion(JSON.stringify(exactOriginsForHost("acceptance.example")) === JSON.stringify(["https://acceptance.example/*", "http://acceptance.example/*"]), "Exact-origin model changed");
    }),
    check("No options page or content script", () => {
      for (const key of ["options_page", "options_ui", "content_scripts"]) assertion(!Object.hasOwn(manifest, key), `${key} is forbidden`);
    }),
    check("Profile Set milestone 152", () => {
      assertion(VERIFIED_PROFILE_SET.milestone === 152, "Profile milestone changed");
      assertion(/Chrome\/152\.0\.0\.0/.test(VERIFIED_PROFILE_SET.desktopUserAgent), "Desktop UA mismatch");
      assertion(/Chrome\/152\.0\.0\.0 Mobile/.test(VERIFIED_PROFILE_SET.mobileUserAgent), "Mobile UA mismatch");
    }),
    check("Expected DNR shape", () => {
      assertion(fixtureRules.length === 1, "Expected one fixture rule");
      const rule = fixtureRules[0];
      assertion(rule.action.type === "modifyHeaders", "Expected modifyHeaders");
      assertion(JSON.stringify(rule.condition.resourceTypes) === JSON.stringify(["main_frame"]), "Expected main_frame only");
      assertion(JSON.stringify(rule.action.requestHeaders) === JSON.stringify([{ header: "User-Agent", operation: "set", value: VERIFIED_PROFILE_SET.desktopUserAgent }]), "Expected User-Agent set only");
      assertion(!rule.action.responseHeaders && !rule.condition.regexFilter && !rule.action.redirect, "Forbidden DNR field");
    }),
    check("Exact-host filter semantics", () => {
      assertion(matchesExactHostScope("acceptance.example", "http://acceptance.example/path"), "HTTP exact host must match");
      assertion(matchesExactHostScope("acceptance.example", "https://acceptance.example:8443/path"), "HTTPS exact host must match");
      for (const url of ["https://evil.acceptance.example/", "https://acceptance.example.evil.test/", "ftp://acceptance.example/"]) assertion(!matchesExactHostScope("acceptance.example", url), `Unexpected match: ${url}`);
    }),
    check("No forbidden required permissions", () => {
      const forbidden = ["tabs", "scripting", "webRequest", "cookies", "debugger", "proxy"];
      assertion(forbidden.every((permission) => !manifest.permissions.includes(permission)), "Forbidden permission found");
    }),
    check("No remote code or communication", () => {
      assertion(!/<script[^>]+src=["']https?:/i.test(productText), "Remote script found");
      assertion(!/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/.test(productText), "Network API found");
      assertion(!/\b(?:eval|Function)\s*\(/.test(productText), "Dynamic code execution found");
    }),
    check("No telemetry or analytics", () => assertion(!/\b(?:telemetry|analytics|tracking)\b/i.test(productText), "Telemetry marker found")),
    check("No forbidden identity or DNR capability", () => {
      assertion(!/Sec-CH-UA|regexFilter|responseHeaders|\bredirect\b/i.test(productText), "Forbidden identity/DNR capability found");
    }),
    check("No service-specific internal API", () => assertion(!/youtubei|clientName|clientVersion|visitorData/i.test(productText), "Service-specific API marker found")),
    check("No arbitrary identity UI", () => {
      assertion(!/User-Agent|custom\s+(?:UA|header)|rule\s*ID|wildcard/i.test(popupHtml), "Arbitrary identity control found");
      assertion(!/language\s*(?:selector|switch)/i.test(popupHtml), "Language switch found");
    }),
    check("No external dependencies", () => {
      assertion(!packageJson.dependencies && !packageJson.devDependencies, "External dependencies found");
    }),
  ];

  const results = await Promise.all(checks);
  return Object.freeze({ status: "PASS", passed: results.length, failed: 0, results: Object.freeze(results) });
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    const report = await runAcceptancePreflight();
    for (const result of report.results) console.log(`PASS ${result.name}`);
    console.log(`ACCEPTANCE PREFLIGHT PASS ${report.passed}/${report.passed}`);
  } catch (error) {
    console.error(`ACCEPTANCE PREFLIGHT FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
