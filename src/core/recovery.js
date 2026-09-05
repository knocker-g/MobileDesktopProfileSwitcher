import {
  SCHEMA_STATUS,
  configurationOf,
  inspectPersistedState,
  stateWithPending,
} from "./storage-schema.js";
import { TRANSACTION_ERROR, TransactionError } from "./transaction-error.js";

export const RECOVERY_ACTION = Object.freeze({
  RECONCILE_CURRENT: "reconcile_current",
  ROLLBACK_PENDING: "rollback_pending",
  FINALIZE_COMMIT: "finalize_commit",
  FAIL_CLOSED: "fail_closed",
});

function sameConfiguration(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function failClosedDecision(reason, schemaStatus) {
  return Object.freeze({
    action: RECOVERY_ACTION.FAIL_CLOSED,
    reason,
    schemaStatus,
    preserveRawState: true,
    clearJournal: false,
    targetState: null,
  });
}

export function decideStartupRecovery(rawState) {
  const inspection = inspectPersistedState(rawState);
  if (inspection.schemaStatus !== SCHEMA_STATUS.CURRENT_VALID) {
    const reason =
      inspection.schemaStatus === SCHEMA_STATUS.CURRENT_CORRUPT
        ? TRANSACTION_ERROR.INVALID_PERSISTED_STATE
        : TRANSACTION_ERROR.UNSUPPORTED_SCHEMA;
    return failClosedDecision(reason, inspection.schemaStatus);
  }

  const state = inspection.state;
  const current = configurationOf(state);
  const journal = state.pendingMutation;
  if (journal === null) {
    return Object.freeze({
      action: RECOVERY_ACTION.RECONCILE_CURRENT,
      reason: null,
      schemaStatus: inspection.schemaStatus,
      preserveRawState: false,
      clearJournal: false,
      targetState: current,
    });
  }

  if (state.revision === journal.baseRevision) {
    return Object.freeze({
      action: RECOVERY_ACTION.ROLLBACK_PENDING,
      reason: "journal_before_commit",
      schemaStatus: inspection.schemaStatus,
      preserveRawState: false,
      clearJournal: true,
      targetState: current,
    });
  }

  if (
    state.revision === journal.nextRevision &&
    sameConfiguration(current, journal.nextState)
  ) {
    return Object.freeze({
      action: RECOVERY_ACTION.FINALIZE_COMMIT,
      reason: "journal_after_commit",
      schemaStatus: inspection.schemaStatus,
      preserveRawState: false,
      clearJournal: true,
      targetState: current,
    });
  }

  return failClosedDecision("ambiguous_pending_mutation", inspection.schemaStatus);
}

export async function recoverAtStartup({ storage, derivedState }) {
  let rawState;
  try {
    rawState = await storage.readState();
  } catch (cause) {
    try {
      await derivedState.failClosed(TRANSACTION_ERROR.PERSISTENCE_FAILURE);
    } catch {
      // The caller still receives the storage read failure.
    }
    throw new TransactionError(
      TRANSACTION_ERROR.PERSISTENCE_FAILURE,
      "Startup recovery could not read persisted state.",
      { phase: "read", preserveRawState: true },
      { cause },
    );
  }
  const decision = decideStartupRecovery(rawState);

  if (decision.action === RECOVERY_ACTION.FAIL_CLOSED) {
    await derivedState.failClosed(decision.reason);
    return decision;
  }

  try {
    await derivedState.apply(decision.targetState);
    if (decision.clearJournal) {
      await storage.writeState(stateWithPending(decision.targetState, null));
    }
    return decision;
  } catch (cause) {
    try {
      await derivedState.failClosed("startup_recovery_failure");
    } catch {
      // The caller still receives one stable recovery error.
    }
    throw new TransactionError(
      TRANSACTION_ERROR.ROLLBACK_FAILURE,
      "Startup recovery could not establish a safe derived state.",
      { action: decision.action, preserveRawState: true },
      { cause },
    );
  }
}
