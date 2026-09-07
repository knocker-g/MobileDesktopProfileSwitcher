import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../../src/ui/popup.html", import.meta.url), "utf8");
const css = await readFile(new URL("../../src/ui/popup.css", import.meta.url), "utf8");
const js = await readFile(new URL("../../src/ui/popup.js", import.meta.url), "utf8");

const expectedElementBindings = Object.freeze({
  app: "app",
  globalToggle: "global-toggle",
  globalState: "global-state",
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
  for (const text of ["Mobile Desktop Profile Switcher", "Current site", "Add site", "Hosts", "Profile", "Cancel", "Save"]) assert.match(html, new RegExp(text));
  assert.doesNotMatch(html, />MDPS</);
  assert.doesNotMatch(html, /[\u3040-\u30ff\u3400-\u9fff]/);
  assert.match(html, /role="status"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /<label for="site-name">/);
  assert.match(html, /<label for="form-profile">Profile<\/label>/);
});

test("Global enabled control uses accessible switch semantics and a text state", () => {
  assert.match(html, /<label class="global-switch" for="global-toggle">/);
  assert.match(html, /<span id="global-state">/);
  assert.match(html, /<input id="global-toggle" type="checkbox" role="switch" aria-label="Global enabled" disabled>/);
  assert.match(js, /elements\.globalState\.textContent = state\.enabled \? "On" : "Off"/);
  assert.match(js, /elements\.globalToggle\.addEventListener\("change"/);
  assert.doesNotMatch(html, /<button id="global-toggle"/);
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

test("unregistered current site uses one lightweight keyboard-accessible card trigger", () => {
  assert.doesNotMatch(js, /add\.textContent = "Add this site"/);
  assert.match(js, /add\.className = "current-site-trigger"/);
  assert.match(js, /classList\.toggle\("unregistered-current"/);
  assert.match(js, /add\.setAttribute\("aria-label", `Add \$\{model\.hostname\}`\)/);
  assert.match(js, /chevron\.textContent = ">"/);
  assert.match(js, /add\.type = "button"/);
  assert.match(js, /add\.addEventListener\("click"/);
  assert.match(css, /\.current-site-trigger\s*\{[^}]*min-height/s);
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
  assert.match(js, /"current-profile"/);
  assert.doesNotMatch(js, /`site-profile-\$\{site\.id\}`/);
});

test("host summaries, permission warning, and edit footer controls are present", () => {
  assert.match(js, /function hostSummary\(/);
  assert.match(js, /for \(const host of site\.hosts\)/);
  assert.match(js, /function permissionWarning\(/);
  assert.match(js, /addHostRow\(form\)/);
  assert.match(js, /remove\.setAttribute\("aria-label", hostname \? `Remove host \$\{hostname\}` : `Remove host \$\{index \+ 1\}`\)/);
  assert.match(html, /class="form-footer sticky-actions"/);
  for (const id of ["cancel-form", "save-site"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.doesNotMatch(html, /Remove site|start-remove|remove-confirm|confirm-remove/);
  assert.match(css, /\.form-footer\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.form-footer\s*\{[^}]*justify-content:\s*flex-end/s);
});

test("site cards separate edit, profile, and inline removal interactions", () => {
  assert.match(js, /function editSiteTrigger\(site\)/);
  assert.match(js, /trigger\.setAttribute\("aria-label", `Edit \$\{site\.name\} site`\)/);
  assert.match(js, /icon\.className = "edit-icon"/);
  assert.match(js, /icon\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(js, /heading\.append\(name, icon\)/);
  assert.match(js, /trigger\.append\(heading, hostSummary\(site\)\)/);
  assert.match(js, /function siteCardActions\(site\)/);
  assert.match(js, /remove\.setAttribute\("aria-label", `Remove \$\{site\.name\}`\)/);
  assert.match(js, /pendingDeleteSiteId === site\.id/);
  assert.match(js, /cancel\.addEventListener\("click", \(\) => \{ pendingDeleteSiteId = null; render\(\); \}\)/);
  assert.match(js, /confirm\.addEventListener\("click", \(\) => removeSite\(site\.id\)\)/);
  assert.match(js, /MESSAGE_TYPE\.DELETE_SITE/);
  assert.match(js, /elements\.otherSitesSummary\.textContent = `Sites · \$\{state\.sites\.length\}`/);
  assert.match(js, /for \(const site of state\.sites\)/);
  assert.match(js, /function siteCardActions\(site\)/);
  assert.doesNotMatch(js, /site-edit-button|container\.append\(edit/);
  assert.match(js, /remove\.className = "site-icon-button site-remove-button"/);
  assert.match(css, /\.site-card-actions\s*\{[^}]*display:\s*flex[^}]*align-items:\s*flex-start/s);
  assert.match(css, /\.site-icon-button, \.host-remove-button\s*\{[^}]*width:\s*44px[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s);
  assert.match(css, /\.site-card-top\.is-confirming/);
  assert.match(css, /\.site-card-heading\s*\{[^}]*justify-content:\s*flex-start[^}]*gap:\s*6px/s);
  assert.doesNotMatch(css, /\.site-edit-button/);
  assert.doesNotMatch(js, /textContent = "Edit site"/);
});

test("action hierarchy uses light primary tokens and lightweight tertiary controls", () => {
  for (const token of ["color-primary", "color-primary-hover", "color-primary-active", "color-primary-text"]) {
    assert.match(css, new RegExp(`--${token}:`));
  }
  assert.doesNotMatch(css, /#1769e0|--accent:/i);
  assert.match(css, /button\s*\{[^}]*background:\s*var\(--color-primary\)[^}]*color:\s*var\(--color-primary-text\)/s);
  assert.match(css, /\.global-switch input:checked \+ \.switch-track\s*\{[^}]*var\(--color-primary\)/s);
  assert.match(html, /id="save-site" type="submit"/);
  assert.match(html, /id="add-host" type="button" class="tertiary-action"/);
  assert.match(css, /\.tertiary-action\s*\{[^}]*width:\s*auto[^}]*border-color:\s*transparent[^}]*background:\s*transparent/s);
});

test("host removal is a compact accessible control and Add host behavior remains wired", () => {
  assert.match(js, /remove\.className = "host-remove-button"/);
  assert.match(js, /remove\.textContent = "×"/);
  assert.match(js, /`Remove host \$\{hostname\}`/);
  assert.match(js, /input\.addEventListener\("input"/);
  assert.match(js, /removeHostRow\(form, index\)/);
  assert.match(js, /elements\.addHost\.addEventListener\("click"/);
  assert.match(js, /addHostRow\(form\)/);
});

test("native edit button provides keyboard activation and Sites cards omit Profile selects", () => {
  const editTrigger = js.match(/function editSiteTrigger\(site\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
  const siteLoop = js.match(/for \(const site of state\.sites\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.match(js, /trigger\.type = "button"/);
  assert.match(js, /trigger\.addEventListener\("click"/);
  assert.doesNotMatch(editTrigger, /profileSelect/);
  assert.doesNotMatch(siteLoop, /profileSelect/);
  assert.match(html, /<select id="form-profile"/);
});

test("Current Site Profile change uses post-commit active-tab reload while edit Save does not", () => {
  assert.match(js, /applyCurrentSiteProfile\(\{/);
  assert.match(js, /commitProfile: \(payload\) => command\(MESSAGE_TYPE\.SET_PROFILE, payload\)/);
  assert.match(js, /refreshState: refresh/);
  assert.match(js, /reloadTab: \(tabId\) => activeTab\.reload\(tabId\)/);
  assert.match(js, /Profile changed, but the page could not be reloaded\./);
  assert.doesNotMatch(js, /SET_ENABLED[\s\S]{0,300}activeTab\.reload/);
  assert.doesNotMatch(js, /UPDATE_SITE[\s\S]{0,300}activeTab\.reload/);
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
