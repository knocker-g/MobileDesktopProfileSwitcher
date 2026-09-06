import { createChromeDnrAdapter } from "../adapters/chrome-dnr.js";
import { createChromePermissionsAdapter } from "../adapters/chrome-permissions.js";
import { createChromeStorageAdapter } from "../adapters/chrome-storage.js";
import { createDnrReconciler } from "../adapters/dnr-reconciler.js";
import { createRuntimeBackend } from "./backend.js";
import { createRuntimeMessageHandler, initializeRuntime } from "./runtime.js";

export function createExtensionRuntime(chromeApi, {
  createMutationId = () => crypto.randomUUID(),
  createSiteId = () => crypto.randomUUID(),
} = {}) {
  const storage = createChromeStorageAdapter(chromeApi.storage.local);
  const permissions = createChromePermissionsAdapter(chromeApi.permissions);
  const dnr = createChromeDnrAdapter(chromeApi.declarativeNetRequest);
  const derivedState = createDnrReconciler({ dnr, permissions });
  const backend = createRuntimeBackend({ storage, derivedState, permissions, createMutationId, createSiteId });
  let operationQueue = Promise.resolve();
  const enqueue = (operation) => {
    const result = operationQueue.then(operation);
    operationQueue = result.catch(() => undefined);
    return result;
  };
  const initialize = () => enqueue(() => initializeRuntime({ storage, derivedState }));
  const reconcile = () => enqueue(async () => derivedState.reconcile(await backend.getState()));
  const rawHandler = createRuntimeMessageHandler({ backend, derivedState });
  return Object.freeze({
    storage,
    permissions,
    dnr,
    derivedState,
    backend,
    initialize,
    reconcile,
    handleMessage: async (message) => {
      await initialize();
      return enqueue(() => rawHandler(message));
    },
  });
}

export function registerRuntimeListeners(chromeApi, runtime) {
  const safelyInitialize = () => runtime.initialize().catch((error) => {
    console.error("MDPS runtime initialization failed", error);
  });

  chromeApi.runtime.onInstalled.addListener(safelyInitialize);
  chromeApi.runtime.onStartup.addListener(safelyInitialize);
  chromeApi.permissions.onRemoved.addListener(() => {
    return runtime.reconcile()
      .catch(async (error) => {
        console.error("MDPS permission-revoke reconcile failed", error);
        try { await runtime.derivedState.failClosed("permission_revoke_reconcile_failure"); }
        catch (fatal) { console.error("MDPS fail closed failed", fatal); }
      });
  });
  chromeApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    runtime.handleMessage(message).then(sendResponse);
    return true;
  });
}
