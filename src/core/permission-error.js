export const PERMISSION_ERROR = Object.freeze({
  INVALID_HOST: "invalid_permission_host",
  DENIED: "permission_denied",
  PARTIAL: "permission_partial",
  API_FAILURE: "permission_api_failure",
  REMOVAL_FAILURE: "permission_removal_failure",
  POST_CONDITION_FAILURE: "permission_post_condition_failure",
});

export class PermissionError extends Error {
  constructor(code, message, details = {}, options = {}) {
    super(message, options);
    this.name = "PermissionError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
