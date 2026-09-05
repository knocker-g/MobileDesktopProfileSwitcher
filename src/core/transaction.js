import {
  OPERATION_KIND,
  configurationOf,
  createPendingMutation,
  inspectPersistedState,
  stateWithPending,
  validatePersistedState,
} from "./storage-schema.js";
import { TRANSACTION_ERROR, TransactionError } from "./transaction-error.js";

const OPERATION_VALUES = Object.freeze(Object.values(OPERATION_KIND));

function error(code, message, details = {}, cause) {
  return new TransactionError(code, message, details, cause ? { cause } : {});
}

function nextConfiguration(current, mutationResult) {
  if (!mutationResult || typeof mutationResult !== "object" || Array.isArray(mutationResult)) {
    throw error(
      TRANSACTION_ERROR.INVALID_MUTATION,
      "Mutation must return an object with enabled, nextRuleId, and sites.",
    );
  }

  try {
    return configurationOf({
      schemaVersion: current.schemaVersion,
      revision: current.revision + 1,
      enabled: mutationResult.enabled,
      nextRuleId: mutationResult.nextRuleId,
      sites: mutationResult.sites,
    });
  } catch (cause) {
    throw error(
      TRANSACTION_ERROR.INVALID_MUTATION,
      "Mutation returned an invalid next state.",
      {},
      cause,
    );
  }
}

async function failClosed(derivedState, reason) {
  try {
    await derivedState.failClosed(reason);
  } catch {
    // The primary rollback error retains the unsafe outcome.
  }
}

export function createMutationExecutor({ storage, derivedState, createMutationId }) {
  let queue = Promise.resolve();

  async function executeNow({ expectedRevision, operationKind, mutate }) {
    let rawState;
    try {
      rawState = await storage.readState();
    } catch (cause) {
      await failClosed(derivedState, TRANSACTION_ERROR.PERSISTENCE_FAILURE);
      throw error(
        TRANSACTION_ERROR.PERSISTENCE_FAILURE,
        "Could not read persisted state.",
        { phase: "read", preserveRawState: true },
        cause,
      );
    }
    const inspection = inspectPersistedState(rawState);
    if (inspection.state === null) {
      await failClosed(derivedState, inspection.errorCode);
      throw error(
        inspection.errorCode,
        "Persisted state is not safe to mutate.",
        { schemaStatus: inspection.schemaStatus, preserveRawState: true },
      );
    }

    const currentState = inspection.state;
    if (currentState.pendingMutation !== null) {
      await failClosed(derivedState, "pending_mutation_requires_recovery");
      throw error(
        TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
        "Pending mutation must be recovered before a new mutation.",
        { preserveRawState: true },
      );
    }
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== currentState.revision) {
      throw error(
        TRANSACTION_ERROR.STALE_REVISION,
        "Mutation expected revision does not match current revision.",
        { expectedRevision, actualRevision: currentState.revision },
      );
    }
    if (!OPERATION_VALUES.includes(operationKind) || typeof mutate !== "function") {
      throw error(
        TRANSACTION_ERROR.INVALID_MUTATION,
        "Mutation operation or function is invalid.",
      );
    }

    const current = configurationOf(currentState);
    const next = nextConfiguration(current, mutate(current));
    let journal;
    try {
      journal = createPendingMutation({
        mutationId: createMutationId(),
        operationKind,
        currentState: current,
        nextState: next,
      });
    } catch (cause) {
      throw error(
        TRANSACTION_ERROR.INVALID_MUTATION,
        "Could not create a valid mutation journal.",
        {},
        cause,
      );
    }
    const journaledOldState = stateWithPending(current, journal);

    try {
      await storage.writeState(journaledOldState);
    } catch (cause) {
      throw error(
        TRANSACTION_ERROR.PERSISTENCE_FAILURE,
        "Could not persist the mutation journal.",
        { phase: "journal", recovered: true },
        cause,
      );
    }

    try {
      await derivedState.apply(next);
    } catch (cause) {
      try {
        await derivedState.rollback(current);
        await storage.writeState(stateWithPending(current, null));
      } catch (rollbackCause) {
        await failClosed(derivedState, TRANSACTION_ERROR.DERIVED_APPLY_FAILURE);
        throw error(
          TRANSACTION_ERROR.ROLLBACK_FAILURE,
          "Derived-state apply and rollback failed.",
          { phase: "derived_apply", preserveRawState: true },
          rollbackCause,
        );
      }
      throw error(
        TRANSACTION_ERROR.DERIVED_APPLY_FAILURE,
        "Derived-state apply failed and the old state was restored.",
        { phase: "derived_apply", recovered: true },
        cause,
      );
    }

    const committedWithJournal = stateWithPending(next, journal);
    try {
      await storage.writeState(committedWithJournal);
    } catch (cause) {
      try {
        await derivedState.rollback(current);
        await storage.writeState(stateWithPending(current, null));
      } catch (rollbackCause) {
        await failClosed(derivedState, TRANSACTION_ERROR.PERSISTENCE_FAILURE);
        throw error(
          TRANSACTION_ERROR.ROLLBACK_FAILURE,
          "State persistence and rollback failed.",
          { phase: "state", preserveRawState: true },
          rollbackCause,
        );
      }
      throw error(
        TRANSACTION_ERROR.PERSISTENCE_FAILURE,
        "State persistence failed and the old state was restored.",
        { phase: "state", recovered: true },
        cause,
      );
    }

    const committed = stateWithPending(next, null);
    try {
      await storage.writeState(committed);
    } catch (cause) {
      throw error(
        TRANSACTION_ERROR.PERSISTENCE_FAILURE,
        "State committed but the journal could not be cleared.",
        { phase: "journal_cleanup", recoveryRequired: true },
        cause,
      );
    }

    return validatePersistedState(committed);
  }

  return Object.freeze({
    execute(request) {
      const result = queue.then(() => executeNow(request));
      queue = result.catch(() => undefined);
      return result;
    },
  });
}
