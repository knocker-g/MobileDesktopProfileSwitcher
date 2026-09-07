import { normalizeHostInput } from "../core/hosts.js";
import { PROFILE } from "../core/profiles.js";

export const BADGE_TEXT = Object.freeze({
  DESKTOP: "D",
  MOBILE: "M",
  DEFAULT: "-",
  OFF: "OFF",
  NONE: "",
});

export function badgeTextForTab(state, url, permissionInspections = []) {
  if (!state?.enabled) return BADGE_TEXT.OFF;
  let hostname;
  try { hostname = normalizeHostInput(url); }
  catch { return BADGE_TEXT.NONE; }
  const site = state.sites.find((candidate) => candidate.hosts.some((host) => host.hostname === hostname));
  if (!site) return BADGE_TEXT.NONE;
  const byHost = new Map(permissionInspections.map((item) => [item.hostname, item]));
  const ready = byHost.get(hostname)?.fullyGranted === true;
  if (!ready || site.profile === PROFILE.DEFAULT) return BADGE_TEXT.DEFAULT;
  if (site.profile === PROFILE.DESKTOP) return BADGE_TEXT.DESKTOP;
  if (site.profile === PROFILE.MOBILE) return BADGE_TEXT.MOBILE;
  return BADGE_TEXT.NONE;
}
