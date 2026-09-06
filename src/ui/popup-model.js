import { normalizeHostInput, normalizeHostInputs } from "../core/hosts.js";
import { PROFILE, PROFILE_VALUES } from "../core/profiles.js";
import { validateSiteCollection } from "../core/sites.js";

export const VIEW = Object.freeze({ CURRENT: "current", ADD: "add", EDIT: "edit" });

export function hostnameFromActiveUrl(url) {
  try {
    return normalizeHostInput(url);
  } catch {
    return null;
  }
}

export function createPopupModel(state, activeUrl, permissionInspections = []) {
  const sites = validateSiteCollection(state.sites);
  const hostname = hostnameFromActiveUrl(activeUrl);
  const currentSite = hostname
    ? sites.find((site) => site.hosts.some((host) => host.hostname === hostname)) ?? null
    : null;
  const permissionByHost = new Map(permissionInspections.map((item) => [item.hostname, item]));
  const currentReady = currentSite === null || currentSite.hosts.every(
    (host) => permissionByHost.get(host.hostname)?.fullyGranted === true,
  );
  return Object.freeze({
    enabled: state.enabled,
    revision: state.revision,
    hostname,
    currentSite,
    currentPermissionReady: currentReady,
    otherSites: Object.freeze(sites
      .filter((site) => site.id !== currentSite?.id)
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))),
  });
}

export function createSiteForm({ site = null, hostname = null } = {}) {
  return Object.freeze({
    siteId: site?.id ?? null,
    name: site?.name ?? hostname ?? "",
    profile: site?.profile ?? PROFILE.DEFAULT,
    hosts: Object.freeze(site ? site.hosts.map((host) => host.hostname) : hostname ? [hostname] : [""]),
  });
}

export function validateSiteForm(form) {
  if (!form || typeof form !== "object") return { valid: false, error: "Could not save changes." };
  const name = typeof form.name === "string" ? form.name.trim() : "";
  if (!name) return { valid: false, error: "Enter a site name." };
  if (!Array.isArray(form.hosts) || form.hosts.length === 0 || form.hosts.every((host) => !String(host).trim())) {
    return { valid: false, error: "Enter at least one host." };
  }
  if (!PROFILE_VALUES.includes(form.profile)) return { valid: false, error: "Choose a profile." };
  try {
    const normalized = normalizeHostInputs(form.hosts);
    if (normalized.duplicates.length > 0) {
      return { valid: false, error: "This host is already registered." };
    }
    return Object.freeze({ valid: true, value: Object.freeze({ name, profile: form.profile, hosts: normalized.hosts }) });
  } catch {
    return { valid: false, error: "Enter a valid host or HTTP(S) URL." };
  }
}

export function addHostRow(form) {
  return Object.freeze({ ...form, hosts: Object.freeze([...form.hosts, ""]) });
}

export function removeHostRow(form, index) {
  if (form.hosts.length <= 1) return form;
  return Object.freeze({ ...form, hosts: Object.freeze(form.hosts.filter((_, item) => item !== index)) });
}
