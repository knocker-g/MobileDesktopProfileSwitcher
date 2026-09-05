import { DOMAIN_ERROR, DomainValidationError } from "./domain-error.js";

export const PROFILE = Object.freeze({
  DEFAULT: "default",
  DESKTOP: "desktop",
  MOBILE: "mobile",
});

export const PROFILE_VALUES = Object.freeze(Object.values(PROFILE));

export const VERIFIED_PROFILE_SET = Object.freeze({
  milestone: 152,
  desktopUserAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
  mobileUserAgent:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36",
});

export function userAgentForProfile(profile) {
  switch (profile) {
    case PROFILE.DEFAULT:
      return null;
    case PROFILE.DESKTOP:
      return VERIFIED_PROFILE_SET.desktopUserAgent;
    case PROFILE.MOBILE:
      return VERIFIED_PROFILE_SET.mobileUserAgent;
    default:
      throw new DomainValidationError(
        DOMAIN_ERROR.UNKNOWN_PROFILE,
        `Unknown profile: ${String(profile)}`,
        { profile },
      );
  }
}
