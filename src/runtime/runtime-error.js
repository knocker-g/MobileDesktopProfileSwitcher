export const RUNTIME_ERROR = Object.freeze({
  INVALID_MESSAGE: "invalid_message",
  UNKNOWN_COMMAND: "unknown_command",
  PERMISSION_REQUIRED: "permission_required",
  INITIALIZATION_FAILED: "initialization_failed",
  PERMISSION_CLEANUP_REQUIRED: "permission_cleanup_required",
});

export class RuntimeError extends Error {
  constructor(code, message, details = {}, options = {}) {
    super(message, options);
    this.name = "RuntimeError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
