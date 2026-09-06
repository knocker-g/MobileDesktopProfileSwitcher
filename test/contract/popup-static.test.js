import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../../src/ui/popup.html", import.meta.url), "utf8");
const css = await readFile(new URL("../../src/ui/popup.css", import.meta.url), "utf8");
const js = await readFile(new URL("../../src/ui/popup.js", import.meta.url), "utf8");

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
