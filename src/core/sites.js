import { DOMAIN_ERROR, DomainValidationError } from "./domain-error.js";
import { normalizeHostInput } from "./hosts.js";
import { PROFILE_VALUES } from "./profiles.js";

const SITE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SITE_NAME_CODE_POINTS = 80;

function domainError(code, message, details = {}) {
  return new DomainValidationError(code, message, details);
}

export function validateProfile(profile) {
  if (!PROFILE_VALUES.includes(profile)) {
    throw domainError(DOMAIN_ERROR.UNKNOWN_PROFILE, "Unknown Site profile.", {
      profile,
    });
  }
  return profile;
}

export function validateSiteId(id) {
  if (typeof id !== "string" || !SITE_ID.test(id)) {
    throw domainError(
      DOMAIN_ERROR.INVALID_SITE_ID,
      "Site ID must be a UUID generated for the Site.",
    );
  }
  return id;
}

function normalizeSiteName(name) {
  if (typeof name !== "string" || !name.trim()) {
    throw domainError(
      DOMAIN_ERROR.EMPTY_SITE_NAME,
      "Site name must not be empty.",
    );
  }

  const normalized = name.trim();
  if (/[\u0000-\u001f\u007f]/.test(normalized)) {
    throw domainError(
      DOMAIN_ERROR.INVALID_SITE_NAME,
      "Site name must not contain control characters.",
    );
  }
  if ([...normalized].length > MAX_SITE_NAME_CODE_POINTS) {
    throw domainError(
      DOMAIN_ERROR.INVALID_SITE_NAME,
      "Site name must contain at most 80 Unicode code points.",
    );
  }
  return normalized;
}

function normalizeHostEntry(entry, seenHosts, seenRuleIds) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw domainError(DOMAIN_ERROR.INVALID_HOST, "Host entry is invalid.");
  }

  const hostname = normalizeHostInput(entry.hostname);
  if (seenHosts.has(hostname)) {
    throw domainError(DOMAIN_ERROR.DUPLICATE_HOST, "Site contains a duplicate host.", {
      hostname,
    });
  }
  seenHosts.add(hostname);

  if (!Number.isSafeInteger(entry.ruleId) || entry.ruleId <= 0) {
    throw domainError(
      DOMAIN_ERROR.INVALID_RULE_ID,
      "Host rule ID must be a positive safe integer.",
      { hostname },
    );
  }
  if (seenRuleIds.has(entry.ruleId)) {
    throw domainError(
      DOMAIN_ERROR.DUPLICATE_RULE_ID,
      "Rule ID must be unique.",
      { ruleId: entry.ruleId },
    );
  }
  seenRuleIds.add(entry.ruleId);

  return Object.freeze({ hostname, ruleId: entry.ruleId });
}

function normalizeSite(site, collectionRuleIds = new Set()) {
  if (!site || typeof site !== "object" || Array.isArray(site)) {
    throw domainError(DOMAIN_ERROR.INVALID_SITE_ID, "Site must be an object.");
  }

  const id = validateSiteId(site.id);
  const name = normalizeSiteName(site.name);
  const profile = validateProfile(site.profile);
  if (!Array.isArray(site.hosts) || site.hosts.length === 0) {
    throw domainError(DOMAIN_ERROR.EMPTY_HOSTS, "Site must contain at least one host.");
  }

  const seenHosts = new Set();
  const hosts = site.hosts.map((entry) =>
    normalizeHostEntry(entry, seenHosts, collectionRuleIds),
  );

  return Object.freeze({ id, name, profile, hosts: Object.freeze(hosts) });
}

export function validateSite(site) {
  return normalizeSite(site);
}

export function validateSiteCollection(sites) {
  if (!Array.isArray(sites)) {
    throw domainError(DOMAIN_ERROR.INVALID_SITE_ID, "Site collection must be an array.");
  }

  const ids = new Set();
  const hostOwners = new Map();
  const ruleIds = new Set();
  const normalized = [];

  for (const site of sites) {
    const candidate = normalizeSite(site, ruleIds);
    if (ids.has(candidate.id)) {
      throw domainError(DOMAIN_ERROR.DUPLICATE_SITE_ID, "Site ID must be unique.", {
        siteId: candidate.id,
      });
    }
    ids.add(candidate.id);

    for (const { hostname } of candidate.hosts) {
      const owner = hostOwners.get(hostname);
      if (owner) {
        throw domainError(
          DOMAIN_ERROR.DUPLICATE_HOST,
          "A host cannot belong to multiple Sites.",
          { hostname, conflictingSiteId: owner },
        );
      }
      hostOwners.set(hostname, candidate.id);
    }
    normalized.push(candidate);
  }

  return Object.freeze(normalized);
}

export function addSiteCandidate(sites, candidate) {
  return validateSiteCollection([...validateSiteCollection(sites), candidate]);
}

export function updateSiteCandidate(sites, siteId, candidate) {
  const current = validateSiteCollection(sites);
  validateSiteId(siteId);
  const normalizedCandidate = validateSite(candidate);
  if (normalizedCandidate.id !== siteId) {
    throw domainError(
      DOMAIN_ERROR.INVALID_SITE_ID,
      "A Site update cannot change its stable ID.",
      { siteId },
    );
  }

  let found = false;
  const updated = current.map((site) => {
    if (site.id !== siteId) return site;
    found = true;
    const oldRuleIds = new Map(
      site.hosts.map(({ hostname, ruleId }) => [hostname, ruleId]),
    );
    for (const { hostname, ruleId } of normalizedCandidate.hosts) {
      if (oldRuleIds.has(hostname) && oldRuleIds.get(hostname) !== ruleId) {
        throw domainError(
          DOMAIN_ERROR.INVALID_RULE_ID,
          "An existing host must retain its stable rule ID.",
          { hostname },
        );
      }
    }
    return normalizedCandidate;
  });
  if (!found) {
    throw domainError(DOMAIN_ERROR.SITE_NOT_FOUND, "Site was not found.", {
      siteId,
    });
  }
  return validateSiteCollection(updated);
}

export function removeSiteCandidate(sites, siteId) {
  const current = validateSiteCollection(sites);
  validateSiteId(siteId);
  const updated = current.filter((site) => site.id !== siteId);
  if (updated.length === current.length) {
    throw domainError(DOMAIN_ERROR.SITE_NOT_FOUND, "Site was not found.", {
      siteId,
    });
  }
  return Object.freeze(updated);
}
