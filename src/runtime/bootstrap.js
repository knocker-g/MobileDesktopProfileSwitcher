import { createChromeDnrAdapter } from "../adapters/chrome-dnr.js";
import { createChromePermissionsAdapter } from "../adapters/chrome-permissions.js";
import { createChromeStorageAdapter } from "../adapters/chrome-storage.js";
import { createChromeActionBadgeAdapter } from "../adapters/chrome-action-badge.js";
import { createDnrReconciler } from "../adapters/dnr-reconciler.js";
import { createBadgeManager } from "./badge-manager.js";
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
  const badges = createBadgeManager({
    tabs: chromeApi.tabs,
    badge: createChromeActionBadgeAdapter(chromeApi.action),
    backend,
  });
  const refreshBadges = () => badges.refreshAll().catch(() => undefined);
  let operationQueue = Promise.resolve();
  const enqueue = (operation) => {
    const result = operationQueue.then(operation);
    operationQueue = result.catch(() => undefined);
    return result;
  };
  const initialize = () => enqueue(async () => {
    const result = await initializeRuntime({ storage, derivedState });
    await refreshBadges();
    return result;
  });
  const reconcile = () => enqueue(async () => {
    const result = await derivedState.reconcile(await backend.getState());
    await refreshBadges();
    return result;
  });
  const rawHandler = createRuntimeMessageHandler({ backend, derivedState });
  return Object.freeze({
    storage,
    permissions,
    dnr,
    derivedState,
    backend,
    badges,
    initialize,
    reconcile,
    handleMessage: async (message) => {
      await initialize();
      return enqueue(async () => {
        const response = await rawHandler(message);
        if (response.ok && !["get_state", "inspect_permissions"].includes(message?.type)) {
          await refreshBadges();
        }
        return response;
      });
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
  chromeApi.permissions.onAdded.addListener(() => runtime.reconcile().catch((error) => {
    console.error("MDPS permission-added reconcile failed", error);
  }));
  chromeApi.tabs.onActivated.addListener(({ tabId }) => runtime.badges.refreshTab(tabId).catch((error) => {
    console.error("MDPS badge activation refresh failed", error);
  }));
  chromeApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status || changeInfo.url) {
      runtime.badges.refreshTab(tabId, changeInfo.url ?? tab?.url).catch((error) => {
        console.error("MDPS badge navigation refresh failed", error);
      });
    }
  });
  chromeApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    runtime.handleMessage(message).then(sendResponse);
    return true;
  });
}
