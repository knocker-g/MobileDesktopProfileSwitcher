import { validateSiteCollection } from "./sites.js";
import { TRANSACTION_ERROR, TransactionError } from "./transaction-error.js";

export const CURRENT_SCHEMA_VERSION = 1;

export const SCHEMA_STATUS = Object.freeze({
  CURRENT_VALID: "current_valid",
  CURRENT_CORRUPT: "current_corrupt",
  OLDER_SUPPORTED: "older_supported",
  OLDER_UNSUPPORTED: "older_unsupported",
  NEWER_UNSUPPORTED: "newer_unsupported",
  INVALID_VERSION: "invalid_version",
});

export const OPERATION_KIND = Object.freeze({
  CREATE_SITE: "create_site",
  UPDATE_SITE: "update_site",
  REMOVE_SITE: "remove_site",
  SET_PROFILE: "set_profile",
  SET_ENABLED: "set_enabled",
});

const OPERATION_VALUES = Object.freeze(Object.values(OPERATION_KIND));
const MUTATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIGURATION_KEYS = Object.freeze([
  "schemaVersion",
  "revision",
  "enabled",
  "nextRuleId",
  "sites",
]);
const STATE_KEYS = Object.freeze([...CONFIGURATION_KEYS, "pendingMutation"]);
const JOURNAL_KEYS = Object.freeze([
  "mutationId",
  "baseRevision",
  "nextRevision",
  "operationKind",
  "nextState",
]);

function transactionError(code, message, details = {}, cause) {
  return new TransactionError(code, message, details, cause ? { cause } : {});
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw transactionError(
      TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
      `${label} has unknown or missing fields.`,
      { label },
    );
  }
}

function validateRevision(revision, label = "revision") {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw transactionError(
      TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
      `${label} must be a non-negative safe integer.`,
      { label },
    );
  }
  return revision;
}

function validateConfiguration(raw, expectedSchema = CURRENT_SCHEMA_VERSION) {
  if (!isRecord(raw)) {
    throw transactionError(
      TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
      "Persisted configuration must be an object.",
    );
  }
  assertExactKeys(raw, CONFIGURATION_KEYS, "configuration");
  if (raw.schemaVersion !== expectedSchema) {
    throw transactionError(
      TRANSACTION_ERROR.UNSUPPORTED_SCHEMA,
      "Configuration schema is not the current schema.",
      { schemaVersion: raw.schemaVersion },
    );
  }

  const revision = validateRevision(raw.revision);
  if (typeof raw.enabled !== "boolean") {
    throw transactionError(
      TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
      "enabled must be boolean.",
    );
  }
  if (!Number.isSafeInteger(raw.nextRuleId) || raw.nextRuleId <= 0) {
    throw transactionError(
      TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
      "nextRuleId must be a positive safe integer.",
    );
  }

  let sites;
  try {
    sites = validateSiteCollection(raw.sites);
  } catch (cause) {
    throw transactionError(
      TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
      "Persisted Site collection is invalid.",
      {},
      cause,
    );
  }

  const largestRuleId = sites.reduce(
    (largest, site) =>
      site.hosts.reduce((siteLargest, host) => Math.max(siteLargest, host.ruleId), largest),
    0,
  );
  if (raw.nextRuleId <= largestRuleId) {
    throw transactionError(
      TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
      "nextRuleId must be greater than every reserved rule ID.",
    );
  }

  return Object.freeze({
    schemaVersion: expectedSchema,
    revision,
    enabled: raw.enabled,
    nextRuleId: raw.nextRuleId,
    sites,
  });
}

function validateJournal(raw) {
  if (!isRecord(raw)) {
    throw transactionError(
      TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
      "pendingMutation must be null or an object.",
    );
  }
  assertExactKeys(raw, JOURNAL_KEYS, "pendingMutation");
  if (typeof raw.mutationId !== "string" || !MUTATION_ID.test(raw.mutationId)) {
    throw transactionError(
      TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
      "pendingMutation mutationId must be UUID v4.",
    );
  }
  const baseRevision = validateRevision(raw.baseRevision, "baseRevision");
  const nextRevision = validateRevision(raw.nextRevision, "nextRevision");
  if (nextRevision !== baseRevision + 1) {
    throw transactionError(
      TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
      "pendingMutation revision must advance exactly once.",
    );
  }
  if (!OPERATION_VALUES.includes(raw.operationKind)) {
    throw transactionError(
      TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
      "pendingMutation operation kind is unknown.",
    );
  }

  const nextState = validateConfiguration(raw.nextState);
  if (nextState.revision !== nextRevision) {
    throw transactionError(
      TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
      "pendingMutation nextState revision does not match nextRevision.",
    );
  }

  return Object.freeze({
    mutationId: raw.mutationId,
    baseRevision,
    nextRevision,
    operationKind: raw.operationKind,
    nextState,
  });
}

export function createDefaultState() {
  return Object.freeze({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 0,
    enabled: true,
    nextRuleId: 1,
    sites: Object.freeze([]),
    pendingMutation: null,
  });
}

export function classifySchemaVersion(
  schemaVersion,
  {
    currentVersion = CURRENT_SCHEMA_VERSION,
    supportedOlderVersions = [],
  } = {},
) {
  if (!Number.isSafeInteger(schemaVersion) || schemaVersion <= 0) {
    return SCHEMA_STATUS.INVALID_VERSION;
  }
  if (schemaVersion === currentVersion) return SCHEMA_STATUS.CURRENT_VALID;
  if (schemaVersion > currentVersion) return SCHEMA_STATUS.NEWER_UNSUPPORTED;
  return supportedOlderVersions.includes(schemaVersion)
    ? SCHEMA_STATUS.OLDER_SUPPORTED
    : SCHEMA_STATUS.OLDER_UNSUPPORTED;
}

export function validatePersistedState(raw) {
  if (!isRecord(raw)) {
    throw transactionError(
      TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
      "Persisted state must be an object.",
    );
  }
  assertExactKeys(raw, STATE_KEYS, "persisted state");

  const schemaStatus = classifySchemaVersion(raw.schemaVersion);
  if (schemaStatus !== SCHEMA_STATUS.CURRENT_VALID) {
    throw transactionError(
      TRANSACTION_ERROR.UNSUPPORTED_SCHEMA,
      "Persisted schema is unsupported.",
      { schemaStatus, schemaVersion: raw.schemaVersion },
    );
  }

  const configuration = validateConfiguration(
    Object.fromEntries(CONFIGURATION_KEYS.map((key) => [key, raw[key]])),
  );
  const pendingMutation =
    raw.pendingMutation === null ? null : validateJournal(raw.pendingMutation);
  return Object.freeze({ ...configuration, pendingMutation });
}

export function inspectPersistedState(raw) {
  if (!isRecord(raw)) {
    return Object.freeze({
      schemaStatus: SCHEMA_STATUS.CURRENT_CORRUPT,
      state: null,
      errorCode: TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
    });
  }

  const schemaStatus = classifySchemaVersion(raw.schemaVersion);
  if (schemaStatus !== SCHEMA_STATUS.CURRENT_VALID) {
    return Object.freeze({
      schemaStatus,
      state: null,
      errorCode: TRANSACTION_ERROR.UNSUPPORTED_SCHEMA,
    });
  }

  try {
    return Object.freeze({
      schemaStatus: SCHEMA_STATUS.CURRENT_VALID,
      state: validatePersistedState(raw),
      errorCode: null,
    });
  } catch (error) {
    return Object.freeze({
      schemaStatus: SCHEMA_STATUS.CURRENT_CORRUPT,
      state: null,
      errorCode: error.code ?? TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
    });
  }
}

export function configurationOf(state) {
  const configuration = {};
  for (const key of CONFIGURATION_KEYS) configuration[key] = state[key];
  return validateConfiguration(configuration);
}

export function stateWithPending(configuration, pendingMutation) {
  const canonical = configurationOf(configuration);
  return validatePersistedState({ ...canonical, pendingMutation });
}

export function createPendingMutation({
  mutationId,
  operationKind,
  currentState,
  nextState,
}) {
  const current = configurationOf(currentState);
  const next = validateConfiguration(nextState);
  return validateJournal({
    mutationId,
    baseRevision: current.revision,
    nextRevision: next.revision,
    operationKind,
    nextState: next,
  });
}
