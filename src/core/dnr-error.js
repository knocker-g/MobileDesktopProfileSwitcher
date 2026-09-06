export const DNR_ERROR = Object.freeze({
  INVALID_RULE_ID: "invalid_rule_id",
  RULE_ID_EXHAUSTED: "rule_id_exhausted",
  RULE_LIMIT_EXCEEDED: "dnr_rule_limit_exceeded",
  INVALID_RULE: "invalid_dnr_rule",
  INVALID_PERMISSION_INPUT: "invalid_permission_input",
  API_FAILURE: "dnr_api_failure",
  POST_CONDITION_FAILURE: "dnr_post_condition_failure",
  FAIL_CLOSED_FAILURE: "dnr_fail_closed_failure",
});

export class DnrError extends Error {
  constructor(code, message, details = {}, options = {}) {
    super(message, options);
    this.name = "DnrError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
