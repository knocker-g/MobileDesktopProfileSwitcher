import { normalizeHostInputs } from "../core/hosts.js";
import { PROFILE, PROFILE_VALUES } from "../core/profiles.js";
import { allocateRuleIds } from "../core/rule-ids.js";
import {
  addSiteCandidate,
  removeSiteCandidate,
  updateSiteCandidate,
  validateSiteId,
} from "../core/sites.js";

function existingHosts(sites) {
  return sites.flatMap((site) => site.hosts);
}

function candidateWithAllocatedHosts(current, input, id) {
  const normalized = normalizeHostInputs(input.hosts);
  if (normalized.duplicates.length > 0) {
    throw new TypeError("Site contains duplicate hosts.");
  }
  const hostnames = normalized.hosts;
  const allocation = allocateRuleIds({
    existingHosts: existingHosts(current.sites),
    hostnames,
    nextRuleId: current.nextRuleId,
  });
  return {
    candidate: { id, name: input.name, profile: input.profile, hosts: allocation.hosts },
    nextRuleId: allocation.nextRuleId,
  };
}

export function createSiteMutation(current, input, createSiteId) {
  if (!input || typeof input !== "object" || "id" in input || typeof createSiteId !== "function") {
    throw new TypeError("Site creation input is invalid.");
  }
  const allocated = candidateWithAllocatedHosts(current, input, createSiteId());
  return {
    ...current,
    nextRuleId: allocated.nextRuleId,
    sites: addSiteCandidate(current.sites, allocated.candidate),
  };
}

export function updateSiteMutation(current, input) {
  if (!input || typeof input !== "object") throw new TypeError("Site update input is invalid.");
  const siteId = validateSiteId(input.siteId);
  const existing = current.sites.find((site) => site.id === siteId);
  if (!existing) return updateSiteCandidate(current.sites, siteId, {});
  const allocated = candidateWithAllocatedHosts(
    current,
    { name: input.name, profile: input.profile, hosts: input.hosts },
    siteId,
  );
  return {
    ...current,
    nextRuleId: allocated.nextRuleId,
    sites: updateSiteCandidate(current.sites, siteId, allocated.candidate),
  };
}

export function deleteSiteMutation(current, siteId) {
  return { ...current, sites: removeSiteCandidate(current.sites, siteId) };
}

export function setProfileMutation(current, siteId, profile) {
  if (!PROFILE_VALUES.includes(profile)) throw new RangeError("Unknown profile.");
  const site = current.sites.find((item) => item.id === validateSiteId(siteId));
  if (!site) return updateSiteCandidate(current.sites, siteId, {});
  return {
    ...current,
    sites: updateSiteCandidate(current.sites, siteId, { ...site, profile }),
  };
}

export function setEnabledMutation(current, enabled) {
  if (typeof enabled !== "boolean") throw new TypeError("enabled must be boolean.");
  return { ...current, enabled };
}

export function profileInputIsSafe(profile) {
  return profile === PROFILE.DEFAULT || profile === PROFILE.DESKTOP || profile === PROFILE.MOBILE;
}
