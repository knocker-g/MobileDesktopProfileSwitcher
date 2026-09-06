import { normalizeHostInput } from "./hosts.js";
import { DNR_ERROR, DnrError } from "./dnr-error.js";

// DNR Rule.id is an IDL `long`: a signed 32-bit integer, and must be >= 1.
export const MAX_DNR_RULE_ID = 2_147_483_647;

function fail(code, message, details = {}) {
  throw new DnrError(code, message, details);
}

function canonicalHost(hostname) {
  let normalized;
  try {
    normalized = normalizeHostInput(hostname);
  } catch (cause) {
    throw new DnrError(DNR_ERROR.INVALID_RULE_ID, "Cannot allocate for an invalid host.", {}, { cause });
  }
  if (normalized !== hostname) fail(DNR_ERROR.INVALID_RULE_ID, "Host must already be canonical.");
  return hostname;
}

export function allocateRuleIds({ existingHosts, hostnames, nextRuleId, maxRuleId = MAX_DNR_RULE_ID }) {
  if (!Array.isArray(existingHosts) || !Array.isArray(hostnames)) {
    fail(DNR_ERROR.INVALID_RULE_ID, "Rule allocation inputs must be arrays.");
  }
  if (!Number.isSafeInteger(nextRuleId) || nextRuleId < 1) {
    fail(DNR_ERROR.INVALID_RULE_ID, "nextRuleId must be a positive integer.");
  }
  if (!Number.isSafeInteger(maxRuleId) || maxRuleId < 1 || maxRuleId > MAX_DNR_RULE_ID) {
    fail(DNR_ERROR.INVALID_RULE_ID, "maxRuleId is outside the DNR ID range.");
  }

  const existing = new Map();
  const usedIds = new Set();
  for (const entry of existingHosts) {
    const hostname = canonicalHost(entry?.hostname);
    if (!Number.isSafeInteger(entry.ruleId) || entry.ruleId < 1 || entry.ruleId > maxRuleId) {
      fail(DNR_ERROR.INVALID_RULE_ID, "Existing rule ID is invalid.", { hostname });
    }
    if (existing.has(hostname) || usedIds.has(entry.ruleId)) {
      fail(DNR_ERROR.INVALID_RULE_ID, "Existing host or rule ID is duplicated.");
    }
    existing.set(hostname, entry.ruleId);
    usedIds.add(entry.ruleId);
  }

  const seen = new Set();
  let cursor = nextRuleId;
  const hosts = hostnames.map((value) => {
    const hostname = canonicalHost(value);
    if (seen.has(hostname)) fail(DNR_ERROR.INVALID_RULE_ID, "Requested host is duplicated.");
    seen.add(hostname);
    const stable = existing.get(hostname);
    if (stable !== undefined) return Object.freeze({ hostname, ruleId: stable });
    while (usedIds.has(cursor) && cursor <= maxRuleId) cursor += 1;
    if (cursor > maxRuleId) {
      fail(DNR_ERROR.RULE_ID_EXHAUSTED, "No DNR rule ID remains.", { nextRuleId: cursor });
    }
    const ruleId = cursor;
    usedIds.add(ruleId);
    cursor += 1;
    return Object.freeze({ hostname, ruleId });
  });

  if (cursor > maxRuleId + 1) fail(DNR_ERROR.RULE_ID_EXHAUSTED, "Rule ID counter overflowed.");
  return Object.freeze({ hosts: Object.freeze(hosts), nextRuleId: cursor });
}
