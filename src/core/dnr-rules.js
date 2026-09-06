import { configurationOf } from "./storage-schema.js";
import { PROFILE, VERIFIED_PROFILE_SET, userAgentForProfile } from "./profiles.js";
import { PERMISSION_STATE } from "./permissions.js";
import { DNR_ERROR, DnrError } from "./dnr-error.js";
import { MAX_DNR_RULE_ID } from "./rule-ids.js";
import { normalizeHostInput } from "./hosts.js";

export const DNR_RULE_PRIORITY = 1;
export const MAX_UNSAFE_DYNAMIC_RULES = 5_000;

function fail(code, message, details = {}) {
  throw new DnrError(code, message, details);
}

export function exactHostUrlFilter(hostname) {
  // Hostnames are canonical ASCII/IDNA values from the Site domain model.
  let canonical;
  try {
    canonical = normalizeHostInput(hostname);
  } catch (cause) {
    throw new DnrError(DNR_ERROR.INVALID_RULE, "DNR host is invalid.", {}, { cause });
  }
  if (canonical !== hostname) fail(DNR_ERROR.INVALID_RULE, "DNR host must already be canonical.");
  return `|http*://${hostname}^`;
}

export function matchesExactHostScope(hostname, url) {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname === hostname;
  } catch {
    return false;
  }
}

export function createUserAgentRule({ id, hostname, userAgent }) {
  if (!Number.isInteger(id) || id < 1 || id > MAX_DNR_RULE_ID) {
    fail(DNR_ERROR.INVALID_RULE_ID, "DNR rule ID is outside the supported range.", { id });
  }
  if (typeof userAgent !== "string" || !userAgent) {
    fail(DNR_ERROR.INVALID_RULE, "DNR User-Agent value is invalid.");
  }
  return Object.freeze({
    id,
    priority: DNR_RULE_PRIORITY,
    action: Object.freeze({
      type: "modifyHeaders",
      requestHeaders: Object.freeze([
        Object.freeze({ header: "User-Agent", operation: "set", value: userAgent }),
      ]),
    }),
    condition: Object.freeze({
      urlFilter: exactHostUrlFilter(hostname),
      resourceTypes: Object.freeze(["main_frame"]),
    }),
  });
}

function permissionMap(inspections) {
  if (!Array.isArray(inspections)) {
    fail(DNR_ERROR.INVALID_PERMISSION_INPUT, "Permission inspections must be an array.");
  }
  const result = new Map();
  for (const inspection of inspections) {
    if (!inspection || typeof inspection.hostname !== "string" || result.has(inspection.hostname)) {
      fail(DNR_ERROR.INVALID_PERMISSION_INPUT, "Permission inspection is invalid or duplicated.");
    }
    if (!Object.values(PERMISSION_STATE).includes(inspection.state)) {
      fail(DNR_ERROR.INVALID_PERMISSION_INPUT, "Permission inspection state is unknown.");
    }
    result.set(inspection.hostname, inspection);
  }
  return result;
}

export function generateExpectedRules(
  state,
  inspections,
  profileSet = VERIFIED_PROFILE_SET,
  { maxRuleCount = MAX_UNSAFE_DYNAMIC_RULES } = {},
) {
  const current = configurationOf(state);
  const permissions = permissionMap(inspections);
  const rules = [];
  const warnings = [];

  for (const site of current.sites) {
    for (const host of site.hosts) {
      const inspection = permissions.get(host.hostname);
      if (!inspection || inspection.state !== PERMISSION_STATE.FULLY_GRANTED) {
        warnings.push(Object.freeze({
          hostname: host.hostname,
          reason: inspection?.state ?? "permission_missing_or_revoked",
        }));
        continue;
      }
      if (!current.enabled || site.profile === PROFILE.DEFAULT) continue;
      const userAgent = site.profile === PROFILE.DESKTOP
        ? profileSet.desktopUserAgent
        : site.profile === PROFILE.MOBILE
          ? profileSet.mobileUserAgent
          : userAgentForProfile(site.profile);
      rules.push(createUserAgentRule({ id: host.ruleId, hostname: host.hostname, userAgent }));
      if (rules.length > maxRuleCount) {
        fail(DNR_ERROR.RULE_LIMIT_EXCEEDED, "Expected DNR rules exceed the configured unsafe dynamic-rule limit.", { maxRuleCount });
      }
    }
  }

  rules.sort((left, right) => left.id - right.id);
  warnings.sort((left, right) => left.hostname.localeCompare(right.hostname));
  return Object.freeze({ rules: Object.freeze(rules), warnings: Object.freeze(warnings) });
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function rulesEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const sortedLeft = [...left].sort((a, b) => a.id - b.id);
  const sortedRight = [...right].sort((a, b) => a.id - b.id);
  return canonicalJson(sortedLeft) === canonicalJson(sortedRight);
}

export function diffDynamicRules(expectedRules, actualRules) {
  const expected = new Map(expectedRules.map((rule) => [rule.id, rule]));
  const actual = new Map(actualRules.map((rule) => [rule.id, rule]));
  if (expected.size !== expectedRules.length || actual.size !== actualRules.length) {
    fail(DNR_ERROR.INVALID_RULE, "Rule set contains duplicate IDs.");
  }
  const removeRuleIds = [];
  const addRules = [];
  const unchanged = [];
  for (const [id, rule] of actual) {
    const desired = expected.get(id);
    if (!desired || canonicalJson(desired) !== canonicalJson(rule)) removeRuleIds.push(id);
    else unchanged.push(id);
  }
  for (const [id, rule] of expected) {
    const current = actual.get(id);
    if (!current || canonicalJson(current) !== canonicalJson(rule)) addRules.push(rule);
  }
  removeRuleIds.sort((a, b) => a - b);
  addRules.sort((a, b) => a.id - b.id);
  unchanged.sort((a, b) => a - b);
  return Object.freeze({
    removeRuleIds: Object.freeze(removeRuleIds),
    addRules: Object.freeze(addRules),
    unchanged: Object.freeze(unchanged),
  });
}
