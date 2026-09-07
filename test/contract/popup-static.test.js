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
  formProfile: "form-profile",
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
  assert.match(html, /<label for="form-profile">Profile<\/label>/);
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

test("popup has one stable responsive width across every view", () => {
  assert.doesNotMatch(css, /grid-template-columns:\s*repeat\(3|text-overflow:\s*ellipsis|overflow-x:\s*(?:auto|scroll)/);
  assert.match(css, /html, body\s*\{[^}]*width:\s*400px[^}]*max-width:\s*100%/s);
  assert.doesNotMatch(css, /#(?:current|form)-view[^}]*width|\.view[^}]*width/);
  assert.match(css, /button, input, select\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/s);
  assert.match(css, /\.host-summary li\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});

test("profile uses accessible selects and deprecated profile buttons are absent", () => {
  for (const profile of ["default", "desktop", "mobile"]) {
    assert.match(html, new RegExp(`<option value="${profile}">`, "i"));
  }
  assert.match(js, /function profileSelect\(/);
  assert.match(js, /select\.addEventListener\("change"/);
  assert.doesNotMatch(js, /function profileButtons\(|aria-pressed.*profile/);
  assert.match(js, /elements\.formProfile\.value/);
});

test("host summaries, permission warning, and edit footer controls are present", () => {
  assert.match(js, /function hostSummary\(/);
  assert.match(js, /for \(const host of site\.hosts\)/);
  assert.match(js, /function permissionWarning\(/);
  assert.match(js, /addHostRow\(form\)/);
  assert.match(js, /remove\.setAttribute\("aria-label", `Remove host \$\{index \+ 1\}`\)/);
  assert.match(html, /class="form-footer sticky-actions"/);
  for (const id of ["start-remove", "cancel-form", "save-site"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(css, /\.form-footer\s*\{[^}]*display:\s*flex/s);
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
