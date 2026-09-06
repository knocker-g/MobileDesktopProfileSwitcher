import { TransactionError, TRANSACTION_ERROR } from "../core/transaction-error.js";

export const STORAGE_KEY = "mdpsState";

function failure(operation, cause) {
  return new TransactionError(
    TRANSACTION_ERROR.PERSISTENCE_FAILURE,
    `Chrome storage ${operation} failed.`,
    { operation, preserveRawState: true },
    { cause },
  );
}

export function createChromeStorageAdapter(storageArea, key = STORAGE_KEY) {
  if (!storageArea || typeof storageArea.get !== "function" || typeof storageArea.set !== "function") {
    throw new TypeError("A Chrome storage area is required.");
  }
  if (typeof key !== "string" || !key) throw new TypeError("Storage key is required.");

  return Object.freeze({
    async readState() {
      try {
        const result = await storageArea.get(key);
        return result?.[key];
      } catch (cause) {
        throw failure("read", cause);
      }
    },

    async writeState(state) {
      try {
        await storageArea.set({ [key]: structuredClone(state) });
      } catch (cause) {
        throw failure("write", cause);
      }
    },
  });
}
