import test from "node:test";
import assert from "node:assert/strict";
import { createChromeStorageAdapter, STORAGE_KEY } from "../../src/adapters/chrome-storage.js";
import { createDefaultState } from "../../src/core/storage-schema.js";
import { TRANSACTION_ERROR } from "../../src/core/transaction-error.js";
import { FakeChromeStorageArea } from "../helpers/fake-chrome-storage.js";

test("Chrome storage adapter returns undefined for initial empty storage", async () => {
  const adapter = createChromeStorageAdapter(new FakeChromeStorageArea());
  assert.equal(await adapter.readState(), undefined);
});

test("Chrome storage adapter writes and reads one canonical key with clone safety", async () => {
  const area = new FakeChromeStorageArea();
  const adapter = createChromeStorageAdapter(area);
  const state = createDefaultState();
  await adapter.writeState(state);
  assert.deepEqual(await adapter.readState(), state);
  assert.deepEqual(Object.keys(area.data), [STORAGE_KEY]);
});

for (const operation of ["read", "write"]) {
  test(`Chrome storage adapter normalizes ${operation} failure`, async () => {
    const area = new FakeChromeStorageArea({}, { failGet: operation === "read", failSet: operation === "write" });
    const adapter = createChromeStorageAdapter(area);
    const action = operation === "read" ? () => adapter.readState() : () => adapter.writeState(createDefaultState());
    await assert.rejects(action, (error) => error.code === TRANSACTION_ERROR.PERSISTENCE_FAILURE);
  });
}
