import assert from "node:assert/strict";
import test from "node:test";

import {
  RECOVERY_ACTION,
  decideStartupRecovery,
  recoverAtStartup,
} from "../../src/core/recovery.js";
import {
  OPERATION_KIND,
  SCHEMA_STATUS,
  createDefaultState,
  createPendingMutation,
  stateWithPending,
} from "../../src/core/storage-schema.js";
import { TRANSACTION_ERROR } from "../../src/core/transaction-error.js";
import {
  FakeDerivedStatePort,
  MemoryStoragePort,
} from "../helpers/fakes.js";

const MUTATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function pendingStates() {
  const current = createDefaultState();
  const next = {
    schemaVersion: 1,
    revision: 1,
    enabled: false,
    nextRuleId: 1,
    sites: [],
  };
  const journal = createPendingMutation({
    mutationId: MUTATION_ID,
    operationKind: OPERATION_KIND.SET_ENABLED,
    currentState: current,
    nextState: next,
  });
  return {
    current,
    next,
    journal,
    beforeCommit: stateWithPending(current, journal),
    afterCommit: stateWithPending(next, journal),
  };
}

test("startup without a journal reconciles current authoritative state", () => {
  const decision = decideStartupRecovery(createDefaultState());
  assert.equal(decision.action, RECOVERY_ACTION.RECONCILE_CURRENT);
  assert.equal(decision.clearJournal, false);
  assert.equal(decision.targetState.revision, 0);
});

test("journal at base revision requires rollback and cleanup", () => {
  const decision = decideStartupRecovery(pendingStates().beforeCommit);
  assert.equal(decision.action, RECOVERY_ACTION.ROLLBACK_PENDING);
  assert.equal(decision.clearJournal, true);
  assert.equal(decision.targetState.revision, 0);
});

test("journal matching committed next state requires finalization", () => {
  const decision = decideStartupRecovery(pendingStates().afterCommit);
  assert.equal(decision.action, RECOVERY_ACTION.FINALIZE_COMMIT);
  assert.equal(decision.clearJournal, true);
  assert.equal(decision.targetState.revision, 1);
});

test("ambiguous journal relation requires fail closed and raw preservation", () => {
  const { journal } = pendingStates();
  const ambiguous = stateWithPending(
    {
      schemaVersion: 1,
      revision: 1,
      enabled: true,
      nextRuleId: 1,
      sites: [],
    },
    journal,
  );
  const decision = decideStartupRecovery(ambiguous);
  assert.equal(decision.action, RECOVERY_ACTION.FAIL_CLOSED);
  assert.equal(decision.reason, "ambiguous_pending_mutation");
  assert.equal(decision.preserveRawState, true);
});

test("unsupported and corrupt schemas require fail closed", () => {
  const newer = decideStartupRecovery({
    ...createDefaultState(),
    schemaVersion: 2,
    future: "preserve",
  });
  assert.equal(newer.action, RECOVERY_ACTION.FAIL_CLOSED);
  assert.equal(newer.schemaStatus, SCHEMA_STATUS.NEWER_UNSUPPORTED);
  assert.equal(newer.reason, TRANSACTION_ERROR.UNSUPPORTED_SCHEMA);

  const corrupt = decideStartupRecovery({ ...createDefaultState(), enabled: 1 });
  assert.equal(corrupt.action, RECOVERY_ACTION.FAIL_CLOSED);
  assert.equal(corrupt.schemaStatus, SCHEMA_STATUS.CURRENT_CORRUPT);
});

test("startup recovery rolls back pending state and clears its journal", async () => {
  const { beforeCommit } = pendingStates();
  const storage = new MemoryStoragePort(beforeCommit);
  const derivedState = new FakeDerivedStatePort();
  const decision = await recoverAtStartup({ storage, derivedState });

  assert.equal(decision.action, RECOVERY_ACTION.ROLLBACK_PENDING);
  assert.equal(derivedState.applyCalls.length, 1);
  assert.equal(storage.rawState().pendingMutation, null);
  assert.equal(storage.rawState().revision, 0);
});

test("startup recovery finalizes a committed state and clears its journal", async () => {
  const { afterCommit } = pendingStates();
  const storage = new MemoryStoragePort(afterCommit);
  const derivedState = new FakeDerivedStatePort();
  const decision = await recoverAtStartup({ storage, derivedState });

  assert.equal(decision.action, RECOVERY_ACTION.FINALIZE_COMMIT);
  assert.equal(derivedState.applyCalls[0].revision, 1);
  assert.equal(storage.rawState().pendingMutation, null);
});

test("fail-closed recovery preserves unsupported raw state", async () => {
  const raw = { ...createDefaultState(), schemaVersion: 2, future: "keep" };
  const storage = new MemoryStoragePort(raw);
  const derivedState = new FakeDerivedStatePort();
  const decision = await recoverAtStartup({ storage, derivedState });

  assert.equal(decision.action, RECOVERY_ACTION.FAIL_CLOSED);
  assert.deepEqual(storage.rawState(), raw);
  assert.deepEqual(derivedState.failClosedCallsLog, [TRANSACTION_ERROR.UNSUPPORTED_SCHEMA]);
});

test("startup apply failure requests fail closed and exposes rollback failure", async () => {
  const storage = new MemoryStoragePort(createDefaultState());
  const derivedState = new FakeDerivedStatePort({ failApplyCalls: [1] });

  await assert.rejects(
    recoverAtStartup({ storage, derivedState }),
    (error) => error.code === TRANSACTION_ERROR.ROLLBACK_FAILURE,
  );
  assert.deepEqual(derivedState.failClosedCallsLog, ["startup_recovery_failure"]);
  assert.deepEqual(storage.rawState(), createDefaultState());
});

test("startup read failure requests fail closed without inventing state", async () => {
  const storage = new MemoryStoragePort(createDefaultState(), { failReadCalls: [1] });
  const derivedState = new FakeDerivedStatePort();

  await assert.rejects(
    recoverAtStartup({ storage, derivedState }),
    (error) =>
      error.code === TRANSACTION_ERROR.PERSISTENCE_FAILURE &&
      error.details.preserveRawState === true,
  );
  assert.deepEqual(derivedState.failClosedCallsLog, [TRANSACTION_ERROR.PERSISTENCE_FAILURE]);
  assert.equal(storage.writeCount, 0);
});
