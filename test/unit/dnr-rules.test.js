import assert from "node:assert/strict";
import test from "node:test";

import { DNR_ERROR } from "../../src/core/dnr-error.js";
import {
  createUserAgentRule,
  diffDynamicRules,
  exactHostUrlFilter,
  generateExpectedRules,
  matchesExactHostScope,
  rulesEqual,
} from "../../src/core/dnr-rules.js";
import { createHostPermissionInspection } from "../../src/core/permissions.js";
import { VERIFIED_PROFILE_SET } from "../../src/core/profiles.js";
import { createDefaultState } from "../../src/core/storage-schema.js";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";

function state({ enabled = true, sites } = {}) {
  return { ...createDefaultState(), enabled, nextRuleId: 10, sites: sites ?? [] };
}

function site(id, profile, entries) {
  return { id, name: id === SITE_A ? "A" : "B", profile, hosts: entries };
}

function grant(hostname, https = true, http = true) {
  return createHostPermissionInspection(hostname, { https, http });
}

test("builds an anchored non-regex exact-host URL filter", () => {
  assert.equal(exactHostUrlFilter("www.youtube.com"), "|http*://www.youtube.com^");
  const filter = exactHostUrlFilter("www.youtube.com");
  assert.ok(!filter.includes("*."));
  assert.ok(!filter.includes("regex"));
});

test("exact-host filter rejects wildcard and noncanonical input", () => {
  for (const hostname of ["*.youtube.com", "WWW.YouTube.COM", "https://www.youtube.com/"]) {
    assert.throws(() => exactHostUrlFilter(hostname), (error) => error.code === DNR_ERROR.INVALID_RULE);
  }
});

test("exact-host scope accepts HTTP/HTTPS paths and ports but no subdomain or other scheme", () => {
  assert.equal(matchesExactHostScope("www.youtube.com", "https://www.youtube.com/watch?v=1"), true);
  assert.equal(matchesExactHostScope("www.youtube.com", "http://www.youtube.com:8080/path"), true);
  assert.equal(matchesExactHostScope("www.youtube.com", "https://www.youtube.com.evil.example/"), false);
  assert.equal(matchesExactHostScope("www.youtube.com", "https://evil.www.youtube.com/"), false);
  assert.equal(matchesExactHostScope("www.youtube.com", "ftp://www.youtube.com/"), false);
});

test("Desktop rule is main-frame User-Agent set only", () => {
  const rule = createUserAgentRule({ id: 1, hostname: "example.com", userAgent: VERIFIED_PROFILE_SET.desktopUserAgent });
  assert.deepEqual(rule, {
    id: 1,
    priority: 1,
    action: { type: "modifyHeaders", requestHeaders: [{ header: "User-Agent", operation: "set", value: VERIFIED_PROFILE_SET.desktopUserAgent }] },
    condition: { urlFilter: "|http*://example.com^", resourceTypes: ["main_frame"] },
  });
  assert.equal("responseHeaders" in rule.action, false);
  assert.equal("regexFilter" in rule.condition, false);
  assert.equal("redirect" in rule.action, false);
});

test("generates Desktop and Mobile rules from the verified set", () => {
  const sites = [
    site(SITE_A, "desktop", [{ hostname: "desktop.example", ruleId: 1 }]),
    site(SITE_B, "mobile", [{ hostname: "mobile.example", ruleId: 2 }]),
  ];
  const result = generateExpectedRules(state({ sites }), [grant("desktop.example"), grant("mobile.example")]);
  assert.equal(result.rules[0].action.requestHeaders[0].value, VERIFIED_PROFILE_SET.desktopUserAgent);
  assert.equal(result.rules[1].action.requestHeaders[0].value, VERIFIED_PROFILE_SET.mobileUserAgent);
});

test("Default and Global OFF generate no rules", () => {
  const defaultSites = [site(SITE_A, "default", [{ hostname: "example.com", ruleId: 1 }])];
  assert.deepEqual(generateExpectedRules(state({ sites: defaultSites }), [grant("example.com")]).rules, []);
  const desktopSites = [site(SITE_A, "desktop", [{ hostname: "example.com", ruleId: 1 }])];
  assert.deepEqual(generateExpectedRules(state({ enabled: false, sites: desktopSites }), [grant("example.com")]).rules, []);
});

test("missing and partial permission suppress only affected hosts with warnings", () => {
  const sites = [site(SITE_A, "desktop", [
    { hostname: "a.example", ruleId: 1 },
    { hostname: "b.example", ruleId: 2 },
    { hostname: "c.example", ruleId: 3 },
  ])];
  const result = generateExpectedRules(state({ sites }), [grant("a.example"), grant("b.example", true, false)]);
  assert.deepEqual(result.rules.map((rule) => rule.id), [1]);
  assert.deepEqual(result.warnings.map((item) => item.hostname), ["b.example", "c.example"]);
});

test("multiple Sites and hosts are deterministic by rule ID", () => {
  const sites = [
    site(SITE_A, "desktop", [{ hostname: "z.example", ruleId: 8 }, { hostname: "a.example", ruleId: 2 }]),
    site(SITE_B, "mobile", [{ hostname: "m.example", ruleId: 5 }]),
  ];
  const result = generateExpectedRules(state({ sites }), [grant("z.example"), grant("a.example"), grant("m.example")]);
  assert.deepEqual(result.rules.map((rule) => rule.id), [2, 5, 8]);
});

test("expected generation fails safely before exceeding the dynamic unsafe-rule limit", () => {
  const sites = [site(SITE_A, "desktop", [
    { hostname: "a.example", ruleId: 1 },
    { hostname: "b.example", ruleId: 2 },
  ])];
  assert.throws(
    () => generateExpectedRules(
      state({ sites }),
      [grant("a.example"), grant("b.example")],
      VERIFIED_PROFILE_SET,
      { maxRuleCount: 1 },
    ),
    (error) => error.code === DNR_ERROR.RULE_LIMIT_EXCEEDED,
  );
});

test("rule equality ignores object-key and rule ordering only", () => {
  const first = createUserAgentRule({ id: 1, hostname: "example.com", userAgent: "UA" });
  const reordered = { condition: first.condition, action: first.action, priority: 1, id: 1 };
  assert.equal(rulesEqual([first], [reordered]), true);
});

test("diff handles no-op, add, remove, and same-ID replacement deterministically", () => {
  const one = createUserAgentRule({ id: 1, hostname: "one.example", userAgent: "UA" });
  const two = createUserAgentRule({ id: 2, hostname: "two.example", userAgent: "UA" });
  assert.deepEqual(diffDynamicRules([one], [one]), { removeRuleIds: [], addRules: [], unchanged: [1] });
  assert.deepEqual(diffDynamicRules([one, two], [one]), { removeRuleIds: [], addRules: [two], unchanged: [1] });
  assert.deepEqual(diffDynamicRules([one], [two, one]), { removeRuleIds: [2], addRules: [], unchanged: [1] });
  const replacement = createUserAgentRule({ id: 1, hostname: "one.example", userAgent: "NEW" });
  assert.deepEqual(diffDynamicRules([replacement], [one]), { removeRuleIds: [1], addRules: [replacement], unchanged: [] });
});

test("rejects invalid rule IDs and duplicated diff IDs", () => {
  assert.throws(() => createUserAgentRule({ id: 0, hostname: "a.example", userAgent: "UA" }), (error) => error.code === DNR_ERROR.INVALID_RULE_ID);
  const one = createUserAgentRule({ id: 1, hostname: "a.example", userAgent: "UA" });
  assert.throws(() => diffDynamicRules([one, one], []), (error) => error.code === DNR_ERROR.INVALID_RULE);
});
