export const TRANSACTION_ERROR = Object.freeze({
  INVALID_PERSISTED_STATE: "invalid_persisted_state",
  UNSUPPORTED_SCHEMA: "unsupported_schema",
  STALE_REVISION: "stale_revision",
  INVALID_MUTATION: "invalid_mutation",
  PERSISTENCE_FAILURE: "persistence_failure",
  DERIVED_APPLY_FAILURE: "derived_apply_failure",
  ROLLBACK_FAILURE: "rollback_failure",
});

export class TransactionError extends Error {
  constructor(code, message, details = {}, options = {}) {
    super(message, options);
    this.name = "TransactionError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
