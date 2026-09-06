import test from "node:test";
import assert from "node:assert/strict";
import { PROFILE } from "../../src/core/profiles.js";
import { createDefaultState } from "../../src/core/storage-schema.js";
import { addHostRow, createPopupModel, createSiteForm, hostnameFromActiveUrl, removeHostRow, validateSiteForm } from "../../src/ui/popup-model.js";

const SITE_A = Object.freeze({
  id: "10000000-0000-4000-8000-000000000001",
  name: "YouTube",
  profile: PROFILE.DESKTOP,
  hosts: Object.freeze([{ hostname: "www.youtube.com", ruleId: 1 }]),
});
const SITE_B = Object.freeze({
  id: "10000000-0000-4000-8000-000000000002",
  name: "Example",
  profile: PROFILE.MOBILE,
  hosts: Object.freeze([{ hostname: "example.com", ruleId: 2 }]),
});

function state(overrides = {}) {
  return { ...createDefaultState(), revision: 3, sites: [SITE_A, SITE_B], nextRuleId: 3, ...overrides };
}

test("active URL yields only a canonical supported hostname", () => {
  assert.equal(hostnameFromActiveUrl("https://WWW.YouTube.com/watch?v=secret"), "www.youtube.com");
  for (const url of ["chrome://extensions", "about:blank", "file:///tmp/a", "chrome-extension://id/popup.html", null]) {
    assert.equal(hostnameFromActiveUrl(url), null);
  }
});

test("current model detects registered and unregistered hosts", () => {
  const registered = createPopupModel(state(), "https://www.youtube.com/watch?v=x", [{ hostname: "www.youtube.com", fullyGranted: true }]);
  assert.equal(registered.currentSite.id, SITE_A.id);
  assert.equal(registered.hostname, "www.youtube.com");
  const unregistered = createPopupModel(state(), "https://other.example/path", []);
  assert.equal(unregistered.currentSite, null);
  assert.equal(unregistered.hostname, "other.example");
});

test("current model preserves selected profile while Global OFF", () => {
  const model = createPopupModel(state({ enabled: false }), "https://www.youtube.com", [{ hostname: "www.youtube.com", fullyGranted: true }]);
  assert.equal(model.enabled, false);
  assert.equal(model.currentSite.profile, PROFILE.DESKTOP);
});

test("permission warning model requires full grant", () => {
  assert.equal(createPopupModel(state(), "https://www.youtube.com", [{ hostname: "www.youtube.com", fullyGranted: false }]).currentPermissionReady, false);
});

test("other Sites exclude current and sort deterministically", () => {
  const model = createPopupModel(state(), "https://www.youtube.com", [{ hostname: "www.youtube.com", fullyGranted: true }]);
  assert.deepEqual(model.otherSites.map((site) => site.name), ["Example"]);
  assert.deepEqual(createPopupModel({ ...state(), sites: [] }, "https://unregistered.example", []).otherSites, []);
});

test("new form prefills current hostname without a full URL", () => {
  assert.deepEqual(createSiteForm({ hostname: "www.youtube.com" }), {
    siteId: null, name: "www.youtube.com", profile: PROFILE.DEFAULT, hosts: ["www.youtube.com"],
  });
});

test("edit form contains canonical stored values", () => {
  assert.deepEqual(createSiteForm({ site: SITE_A }), {
    siteId: SITE_A.id, name: "YouTube", profile: PROFILE.DESKTOP, hosts: ["www.youtube.com"],
  });
});

test("form validation normalizes URLs and strips path, query, scheme, and port", () => {
  const result = validateSiteForm({ name: " YouTube ", profile: PROFILE.DESKTOP, hosts: ["https://WWW.YouTube.com:443/watch?v=x"] });
  assert.equal(result.valid, true);
  assert.deepEqual(result.value, { name: "YouTube", profile: PROFILE.DESKTOP, hosts: ["www.youtube.com"] });
});

test("form validation rejects empty name, empty hosts, duplicate, invalid, and profile", () => {
  assert.equal(validateSiteForm({ name: "", profile: PROFILE.DEFAULT, hosts: ["example.com"] }).error, "Enter a site name.");
  assert.equal(validateSiteForm({ name: "A", profile: PROFILE.DEFAULT, hosts: [] }).error, "Enter at least one host.");
  assert.equal(validateSiteForm({ name: "A", profile: PROFILE.DEFAULT, hosts: ["EXAMPLE.com", "example.com."] }).error, "This host is already registered.");
  assert.equal(validateSiteForm({ name: "A", profile: PROFILE.DEFAULT, hosts: ["*.example.com"] }).valid, false);
  assert.equal(validateSiteForm({ name: "A", profile: "custom", hosts: ["example.com"] }).error, "Choose a profile.");
});

test("host row add/remove operations are immutable and keep one required row", () => {
  const original = createSiteForm({ hostname: "example.com" });
  const added = addHostRow(original);
  assert.deepEqual(added.hosts, ["example.com", ""]);
  assert.deepEqual(removeHostRow(added, 0).hosts, [""]);
  assert.strictEqual(removeHostRow(original, 0), original);
  assert.deepEqual(original.hosts, ["example.com"]);
});
