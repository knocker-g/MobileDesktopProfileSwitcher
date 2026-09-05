export const DOMAIN_ERROR = Object.freeze({
  INVALID_HOST: "invalid_host",
  DUPLICATE_HOST: "duplicate_host",
  EMPTY_SITE_NAME: "empty_site_name",
  INVALID_SITE_NAME: "invalid_site_name",
  EMPTY_HOSTS: "empty_hosts",
  UNKNOWN_PROFILE: "unknown_profile",
  INVALID_SITE_ID: "invalid_site_id",
  DUPLICATE_SITE_ID: "duplicate_site_id",
  INVALID_RULE_ID: "invalid_rule_id",
  DUPLICATE_RULE_ID: "duplicate_rule_id",
  SITE_NOT_FOUND: "site_not_found",
});

export class DomainValidationError extends RangeError {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DomainValidationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
