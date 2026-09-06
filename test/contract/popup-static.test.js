import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../../src/ui/popup.html", import.meta.url), "utf8");
const css = await readFile(new URL("../../src/ui/popup.css", import.meta.url), "utf8");
const js = await readFile(new URL("../../src/ui/popup.js", import.meta.url), "utf8");

const expectedElementBindings = Object.freeze({
  app: "app",
  globalToggle: "global-toggle",
  status: "status",
  error: "error",
  currentView: "current-view",
  currentContent: "current-content",
  otherSites: "other-sites",
  otherSitesSummary: "other-sites-summary",
  siteList: "site-list",
  formView: "form-view",
  formTitle: "form-title",
  siteForm: "site-form",
  siteName: "site-name",
  hostList: "host-list",
  addHost: "add-host",
  formProfiles: "form-profiles",
  removeArea: "remove-area",
  startRemove: "start-remove",
  removeConfirm: "remove-confirm",
  cancelRemove: "cancel-remove",
  confirmRemove: "confirm-remove",
  cancelForm: "cancel-form",
  saveSite: "save-site",
});

function extractPopupElementBindings(source) {
  const block = source.match(/const popupElementIds = Object\.freeze\(\{([\s\S]*?)\}\);/);
  assert.ok(block, "popup element registry must be an explicit frozen mapping");
  return Object.fromEntries(
    [...block[1].matchAll(/^\s*([A-Za-z_$][\w$]*):\s*"([^"]+)",?\s*$/gm)]
      .map(([, property, id]) => [property, id]),
  );
}

test("popup is English-only semantic UI with labelled controls", () => {
  assert.match(html, /<html lang="en">/);
  for (const text of ["Current site", "Add site", "Hosts", "Profile", "Remove site", "Cancel", "Save"]) assert.match(html, new RegExp(text));
  assert.doesNotMatch(html, /[\u3040-\u30ff\u3400-\u9fff]/);
  assert.match(html, /role="status"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /<label for="site-name">/);
});

test("popup has no remote, inline script, custom identity, wildcard, or language UI", () => {
  assert.doesNotMatch(html, /<script(?![^>]*src="popup\.js")/);
  assert.doesNotMatch(html + js, /https?:\/\//);
  assert.doesNotMatch(html, /User-Agent|Sec-CH|custom header|language selector|wildcard/i);
  assert.doesNotMatch(html, /type="text"[^>]+name="(?:ua|ruleId|header)"/i);
});

test("responsive CSS avoids viewport-sized feedback loops and horizontal overflow", () => {
  assert.match(css, /box-sizing:\s*border-box/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.doesNotMatch(css, /\b(?:100)?v[wh]\b|min-width:\s*min\(/);
  assert.match(css, /min-height:\s*44px/);
});

test("popup controller sends only allowlisted typed runtime commands", () => {
  assert.doesNotMatch(js, /userAgent|addRules|ruleId|rawState/);
  for (const type of ["GET_STATE", "INSPECT_PERMISSIONS", "SET_PROFILE", "SET_ENABLED", "CREATE_SITE", "UPDATE_SITE", "DELETE_SITE", "RECONCILE"]) assert.match(js, new RegExp(`MESSAGE_TYPE\\.${type}`));
  assert.doesNotMatch(js, /console\./);
});

test("popup element registry maps every camelCase property to an existing HTML id", () => {
  const bindings = extractPopupElementBindings(js);
  assert.deepEqual(bindings, expectedElementBindings);

  const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  assert.equal(htmlIds.size, [...html.matchAll(/\bid="([^"]+)"/g)].length, "popup HTML ids must be unique");
  for (const [property, id] of Object.entries(bindings)) {
    assert.ok(htmlIds.has(id), `elements.${property} must map to existing #${id}`);
  }
});

test("every popup element reference is defined and bindings fail fast when missing", () => {
  const bindings = extractPopupElementBindings(js);
  const referencedProperties = new Set([...js.matchAll(/\belements\.([A-Za-z_$][\w$]*)/g)].map((match) => match[1]));
  assert.deepEqual([...referencedProperties].sort(), Object.keys(bindings).sort());
  assert.match(js, /if \(!element\) throw new Error\(`Missing popup element: \$\{id\}`\)/);
  assert.doesNotMatch(js, /\[id, document\.getElementById\(id\)\]/);
});
