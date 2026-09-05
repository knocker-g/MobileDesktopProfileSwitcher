import assert from "node:assert/strict";
import test from "node:test";

import { RECOVERY_ACTION, decideStartupRecovery } from "../../src/core/recovery.js";
import {
  OPERATION_KIND,
  createDefaultState,
} from "../../src/core/storage-schema.js";
import { createMutationExecutor } from "../../src/core/transaction.js";
import { TRANSACTION_ERROR } from "../../src/core/transaction-error.js";
import {
  FakeDerivedStatePort,
  MemoryStoragePort,
} from "../helpers/fakes.js";

const MUTATION_IDS = [
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
];
const SITE_ID = "11111111-1111-4111-8111-111111111111";

function idGenerator() {
  let index = 0;
  return () => MUTATION_IDS[index++];
}

function coordinator({ storageOptions, derivedOptions, initialState } = {}) {
  const storage = new MemoryStoragePort(
    initialState ?? createDefaultState(),
    storageOptions,
  );
  const derivedState = new FakeDerivedStatePort(derivedOptions);
  const executor = createMutationExecutor({
    storage,
    derivedState,
    createMutationId: idGenerator(),
  });
  return { storage, derivedState, executor };
}

function setEnabled(enabled) {
  return (current) => ({
    enabled,
    nextRuleId: current.nextRuleId,
    sites: current.sites,
  });
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (error) => error.code === code);
}

test("normal commit persists journal, applies derived state, commits, and clears", async () => {
  const { storage, derivedState, executor } = coordinator();
  const result = await executor.execute({
    expectedRevision: 0,
    operationKind: OPERATION_KIND.SET_ENABLED,
    mutate: setEnabled(false),
  });

  assert.equal(result.revision, 1);
  assert.equal(result.enabled, false);
  assert.equal(result.pendingMutation, null);
  assert.equal(storage.writeCount, 3);
  assert.equal(storage.history[0].revision, 0);
  assert.equal(storage.history[0].pendingMutation.baseRevision, 0);
  assert.equal(storage.history[0].pendingMutation.nextRevision, 1);
  assert.equal(storage.history[1].revision, 1);
  assert.notEqual(storage.history[1].pendingMutation, null);
  assert.equal(storage.history[2].pendingMutation, null);
  assert.equal(derivedState.applyCalls.length, 1);
  assert.equal(derivedState.applyCalls[0].revision, 1);
});

test("stale revision rejects without journal, write, or derived apply", async () => {
  const { storage, derivedState, executor } = coordinator();
  await rejectsCode(
    executor.execute({
      expectedRevision: 4,
      operationKind: OPERATION_KIND.SET_ENABLED,
      mutate: setEnabled(false),
    }),
    TRANSACTION_ERROR.STALE_REVISION,
  );
  assert.equal(storage.writeCount, 0);
  assert.equal(derivedState.applyCalls.length, 0);
  assert.deepEqual(storage.rawState(), createDefaultState());
});

test("journal persistence failure leaves old state and skips derived apply", async () => {
  const { storage, derivedState, executor } = coordinator({
    storageOptions: { failWriteCalls: [1] },
  });
  await rejectsCode(
    executor.execute({
      expectedRevision: 0,
      operationKind: OPERATION_KIND.SET_ENABLED,
      mutate: setEnabled(false),
    }),
    TRANSACTION_ERROR.PERSISTENCE_FAILURE,
  );
  assert.deepEqual(storage.rawState(), createDefaultState());
  assert.equal(derivedState.applyCalls.length, 0);
});

test("derived apply failure rolls back derived and persisted state", async () => {
  const { storage, derivedState, executor } = coordinator({
    derivedOptions: { failApplyCalls: [1] },
  });
  await rejectsCode(
    executor.execute({
      expectedRevision: 0,
      operationKind: OPERATION_KIND.SET_ENABLED,
      mutate: setEnabled(false),
    }),
    TRANSACTION_ERROR.DERIVED_APPLY_FAILURE,
  );
  assert.equal(derivedState.rollbackCalls.length, 1);
  assert.equal(derivedState.rollbackCalls[0].revision, 0);
  assert.deepEqual(storage.rawState(), createDefaultState());
});

test("derived rollback failure requests fail closed and preserves journal", async () => {
  const { storage, derivedState, executor } = coordinator({
    derivedOptions: { failApplyCalls: [1], failRollbackCalls: [1] },
  });
  await rejectsCode(
    executor.execute({
      expectedRevision: 0,
      operationKind: OPERATION_KIND.SET_ENABLED,
      mutate: setEnabled(false),
    }),
    TRANSACTION_ERROR.ROLLBACK_FAILURE,
  );
  assert.notEqual(storage.rawState().pendingMutation, null);
  assert.deepEqual(derivedState.failClosedCallsLog, [
    TRANSACTION_ERROR.DERIVED_APPLY_FAILURE,
  ]);
});

test("state persistence failure restores old derived and persisted state", async () => {
  const { storage, derivedState, executor } = coordinator({
    storageOptions: { failWriteCalls: [2] },
  });
  await rejectsCode(
    executor.execute({
      expectedRevision: 0,
      operationKind: OPERATION_KIND.SET_ENABLED,
      mutate: setEnabled(false),
    }),
    TRANSACTION_ERROR.PERSISTENCE_FAILURE,
  );
  assert.equal(derivedState.applyCalls.length, 1);
  assert.equal(derivedState.rollbackCalls.length, 1);
  assert.deepEqual(storage.rawState(), createDefaultState());
});

test("state failure plus rollback failure requests fail closed", async () => {
  const { storage, derivedState, executor } = coordinator({
    storageOptions: { failWriteCalls: [2] },
    derivedOptions: { failRollbackCalls: [1] },
  });
  await rejectsCode(
    executor.execute({
      expectedRevision: 0,
      operationKind: OPERATION_KIND.SET_ENABLED,
      mutate: setEnabled(false),
    }),
    TRANSACTION_ERROR.ROLLBACK_FAILURE,
  );
  assert.notEqual(storage.rawState().pendingMutation, null);
  assert.deepEqual(derivedState.failClosedCallsLog, [
    TRANSACTION_ERROR.PERSISTENCE_FAILURE,
  ]);
});

test("journal cleanup failure leaves a recoverable committed journal", async () => {
  const { storage, executor } = coordinator({
    storageOptions: { failWriteCalls: [3] },
  });
  await rejectsCode(
    executor.execute({
      expectedRevision: 0,
      operationKind: OPERATION_KIND.SET_ENABLED,
      mutate: setEnabled(false),
    }),
    TRANSACTION_ERROR.PERSISTENCE_FAILURE,
  );
  assert.equal(storage.rawState().revision, 1);
  assert.notEqual(storage.rawState().pendingMutation, null);
  assert.equal(
    decideStartupRecovery(storage.rawState()).action,
    RECOVERY_ACTION.FINALIZE_COMMIT,
  );
});

test("pending state blocks mutation and requests fail closed", async () => {
  const seed = coordinator({ storageOptions: { failWriteCalls: [3] } });
  await rejectsCode(
    seed.executor.execute({
      expectedRevision: 0,
      operationKind: OPERATION_KIND.SET_ENABLED,
      mutate: setEnabled(false),
    }),
    TRANSACTION_ERROR.PERSISTENCE_FAILURE,
  );

  const { storage, derivedState, executor } = coordinator({
    initialState: seed.storage.rawState(),
  });
  await rejectsCode(
    executor.execute({
      expectedRevision: 1,
      operationKind: OPERATION_KIND.SET_ENABLED,
      mutate: setEnabled(true),
    }),
    TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
  );
  assert.equal(storage.writeCount, 0);
  assert.deepEqual(derivedState.failClosedCallsLog, [
    "pending_mutation_requires_recovery",
  ]);
});

test("unsupported schema fails closed without changing raw state", async () => {
  const raw = { ...createDefaultState(), schemaVersion: 2, future: "keep" };
  const { storage, derivedState, executor } = coordinator({ initialState: raw });
  await rejectsCode(
    executor.execute({
      expectedRevision: 0,
      operationKind: OPERATION_KIND.SET_ENABLED,
      mutate: setEnabled(false),
    }),
    TRANSACTION_ERROR.UNSUPPORTED_SCHEMA,
  );
  assert.deepEqual(storage.rawState(), raw);
  assert.deepEqual(derivedState.failClosedCallsLog, [
    TRANSACTION_ERROR.UNSUPPORTED_SCHEMA,
  ]);
});

test("invalid mutation is rejected after validation without writes", async () => {
  const { storage, executor } = coordinator();
  await rejectsCode(
    executor.execute({
      expectedRevision: 0,
      operationKind: OPERATION_KIND.SET_ENABLED,
      mutate: () => ({ enabled: "no", nextRuleId: 1, sites: [] }),
    }),
    TRANSACTION_ERROR.INVALID_MUTATION,
  );
  assert.equal(storage.writeCount, 0);
});

test("concurrent mutations with the same revision serialize and reject stale", async () => {
  const { storage, executor } = coordinator();
  const results = await Promise.allSettled([
    executor.execute({
      expectedRevision: 0,
      operationKind: OPERATION_KIND.SET_ENABLED,
      mutate: setEnabled(false),
    }),
    executor.execute({
      expectedRevision: 0,
      operationKind: OPERATION_KIND.SET_ENABLED,
      mutate: setEnabled(true),
    }),
  ]);

  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.equal(results[1].reason.code, TRANSACTION_ERROR.STALE_REVISION);
  assert.equal(storage.rawState().revision, 1);
  assert.equal(storage.rawState().enabled, false);
});

test("serialized sequential revisions preserve both updates without lost update", async () => {
  const { storage, executor } = coordinator();
  const first = executor.execute({
    expectedRevision: 0,
    operationKind: OPERATION_KIND.SET_ENABLED,
    mutate: setEnabled(false),
  });
  const second = executor.execute({
    expectedRevision: 1,
    operationKind: OPERATION_KIND.CREATE_SITE,
    mutate: (current) => ({
      enabled: current.enabled,
      nextRuleId: 2,
      sites: [
        {
          id: SITE_ID,
          name: "Example",
          profile: "desktop",
          hosts: [{ hostname: "example.com", ruleId: 1 }],
        },
      ],
    }),
  });

  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.revision, 1);
  assert.equal(secondResult.revision, 2);
  assert.equal(storage.rawState().revision, 2);
  assert.equal(storage.rawState().enabled, false);
  assert.equal(storage.rawState().sites.length, 1);
  assert.deepEqual(
    storage.history.filter((state) => state.pendingMutation === null).map((state) => state.revision),
    [1, 2],
  );
});

test("mutation read failure requests fail closed and performs no write", async () => {
  const storage = new MemoryStoragePort(createDefaultState(), { failReadCalls: [1] });
  const derivedState = new FakeDerivedStatePort();
  const executor = createMutationExecutor({
    storage,
    derivedState,
    createMutationId: () => MUTATION_ID,
  });

  await rejectsCode(
    executor.execute({
      expectedRevision: 0,
      operationKind: OPERATION_KIND.SET_ENABLED,
      mutate: setEnabled(false),
    }),
    TRANSACTION_ERROR.PERSISTENCE_FAILURE,
  );
  assert.equal(storage.writeCount, 0);
  assert.deepEqual(derivedState.failClosedCallsLog, [TRANSACTION_ERROR.PERSISTENCE_FAILURE]);
});
