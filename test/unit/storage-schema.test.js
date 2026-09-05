import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENT_SCHEMA_VERSION,
  OPERATION_KIND,
  SCHEMA_STATUS,
  classifySchemaVersion,
  createDefaultState,
  createPendingMutation,
  inspectPersistedState,
  stateWithPending,
  validatePersistedState,
} from "../../src/core/storage-schema.js";
import { TRANSACTION_ERROR } from "../../src/core/transaction-error.js";

const MUTATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SITE_ID = "11111111-1111-4111-8111-111111111111";

function stateWithSite(overrides = {}) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 2,
    enabled: true,
    nextRuleId: 2,
    sites: [
      {
        id: SITE_ID,
        name: "Example",
        profile: "desktop",
        hosts: [{ hostname: "example.com", ruleId: 1 }],
      },
    ],
    pendingMutation: null,
    ...overrides,
  };
}

test("default state is canonical, deeply immutable, and clone-safe", () => {
  const first = createDefaultState();
  const second = createDefaultState();

  assert.deepEqual(first, {
    schemaVersion: 1,
    revision: 0,
    enabled: true,
    nextRuleId: 1,
    sites: [],
    pendingMutation: null,
  });
  assert.notEqual(first, second);
  assert.notEqual(first.sites, second.sites);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.sites));
});

test("validates and freezes a current persisted state", () => {
  const raw = stateWithSite();
  const validated = validatePersistedState(raw);

  assert.deepEqual(validated, raw);
  assert.notEqual(validated, raw);
  assert.ok(Object.isFrozen(validated));
  assert.ok(Object.isFrozen(validated.sites));
  assert.ok(Object.isFrozen(validated.sites[0]));
});

test("rejects corrupt root and field types", () => {
  for (const raw of [
    null,
    [],
    { ...createDefaultState(), revision: -1 },
    { ...createDefaultState(), enabled: "true" },
    { ...createDefaultState(), nextRuleId: 0 },
    { ...createDefaultState(), unknown: true },
  ]) {
    assert.throws(
      () => validatePersistedState(raw),
      (error) => error.code === TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
    );
  }
});

test("classifies current, supported older, unsupported older, and newer schemas", () => {
  assert.equal(classifySchemaVersion(1), SCHEMA_STATUS.CURRENT_VALID);
  assert.equal(
    classifySchemaVersion(1, { currentVersion: 2, supportedOlderVersions: [1] }),
    SCHEMA_STATUS.OLDER_SUPPORTED,
  );
  assert.equal(
    classifySchemaVersion(1, { currentVersion: 2 }),
    SCHEMA_STATUS.OLDER_UNSUPPORTED,
  );
  assert.equal(classifySchemaVersion(2), SCHEMA_STATUS.NEWER_UNSUPPORTED);
  assert.equal(classifySchemaVersion("1"), SCHEMA_STATUS.INVALID_VERSION);
});

test("preserves unsupported schema as an inspection result without coercion", () => {
  const raw = { ...createDefaultState(), schemaVersion: 2, vendorData: "keep" };
  const result = inspectPersistedState(raw);

  assert.equal(result.schemaStatus, SCHEMA_STATUS.NEWER_UNSUPPORTED);
  assert.equal(result.state, null);
  assert.equal(result.errorCode, TRANSACTION_ERROR.UNSUPPORTED_SCHEMA);
  assert.equal(raw.vendorData, "keep");
});

test("classifies a corrupt current schema separately", () => {
  const result = inspectPersistedState({ ...createDefaultState(), sites: "bad" });
  assert.equal(result.schemaStatus, SCHEMA_STATUS.CURRENT_CORRUPT);
  assert.equal(result.state, null);
  assert.equal(result.errorCode, TRANSACTION_ERROR.INVALID_PERSISTED_STATE);
});

test("reuses Phase 2 Site collection validation", () => {
  const raw = stateWithSite({
    sites: [
      {
        id: SITE_ID,
        name: "Bad",
        profile: "desktop",
        hosts: [{ hostname: "*.example.com", ruleId: 1 }],
      },
    ],
  });
  assert.throws(
    () => validatePersistedState(raw),
    (error) =>
      error.code === TRANSACTION_ERROR.INVALID_PERSISTED_STATE &&
      error.cause?.code === "invalid_host",
  );
});

test("requires nextRuleId to exceed every reserved rule ID", () => {
  assert.throws(
    () => validatePersistedState(stateWithSite({ nextRuleId: 1 })),
    (error) => error.code === TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
  );
});

test("creates and validates a minimal pending mutation journal", () => {
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
  const journaled = stateWithPending(current, journal);

  assert.equal(journal.baseRevision, 0);
  assert.equal(journal.nextRevision, 1);
  assert.equal(journal.nextState.enabled, false);
  assert.deepEqual(validatePersistedState(journaled), journaled);
});

test("rejects malformed journal IDs, revisions, kinds, and next states", () => {
  const current = createDefaultState();
  const baseJournal = {
    mutationId: MUTATION_ID,
    baseRevision: 0,
    nextRevision: 1,
    operationKind: OPERATION_KIND.SET_ENABLED,
    nextState: {
      schemaVersion: 1,
      revision: 1,
      enabled: false,
      nextRuleId: 1,
      sites: [],
    },
  };

  for (const pendingMutation of [
    { ...baseJournal, mutationId: "bad" },
    { ...baseJournal, nextRevision: 2 },
    { ...baseJournal, operationKind: "unknown" },
    { ...baseJournal, nextState: { ...baseJournal.nextState, revision: 2 } },
  ]) {
    assert.throws(
      () => validatePersistedState({ ...current, pendingMutation }),
      (error) => error.code === TRANSACTION_ERROR.INVALID_PERSISTED_STATE,
    );
  }
});
