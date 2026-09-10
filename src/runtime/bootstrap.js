import { createChromeDnrAdapter } from "../adapters/chrome-dnr.js";
import { createChromePermissionsAdapter } from "../adapters/chrome-permissions.js";
import { createChromeStorageAdapter } from "../adapters/chrome-storage.js";
import { createChromeActionBadgeAdapter } from "../adapters/chrome-action-badge.js";
import { createDnrReconciler } from "../adapters/dnr-reconciler.js";
import { createBadgeManager } from "./badge-manager.js";
import { createRuntimeBackend } from "./backend.js";
import { createRuntimeMessageHandler, initializeRuntime, MESSAGE_TYPE, publicRuntimeError } from "./runtime.js";
import { startGestureSensitivePermissionCommand } from "./permission-commands.js";

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
  // Initialization reads storage and reconciles its derived DNR state, so it is
  // also the safe entry point for permission-change recovery after worker wake.
  const reconcile = () => initialize();
  const rawHandler = createRuntimeMessageHandler({ backend, derivedState });
  const completeGestureSensitive = (prepared) => enqueue(async () => {
    let response;
    try {
      if (prepared.type === MESSAGE_TYPE.CREATE_SITE_WITH_PERMISSION) {
        response = { ok: true, value: await backend.createSite(prepared) };
      } else if (prepared.type === MESSAGE_TYPE.UPDATE_SITE_WITH_PERMISSION) {
        response = { ok: true, value: await backend.updateSiteWithPermission(prepared) };
      } else {
        const value = await backend.grantSiteAccess(prepared);
        let warning = null;
        if (prepared.currentTabId !== null) {
          try { await chromeApi.tabs.reload(prepared.currentTabId); }
          catch { warning = "reload_failed"; }
        }
        response = { ok: true, value: Object.freeze({ ...value, warning }) };
      }
      await refreshBadges();
      return Object.freeze(response);
    } catch (error) {
      return publicRuntimeError(error);
    }
  });
  const handleNormalMessage = async (message) => {
    await initialize();
    return enqueue(async () => {
      const response = await rawHandler(message);
      if (response.ok && !["get_state", "inspect_permissions"].includes(message?.type)) {
        await refreshBadges();
      }
      return response;
    });
  };
  return Object.freeze({
    storage,
    permissions,
    dnr,
    derivedState,
    backend,
    badges,
    initialize,
    reconcile,
    handleMessage(message) {
      try {
        const permissionOperation = startGestureSensitivePermissionCommand(message, permissions);
        if (permissionOperation !== null) {
          return permissionOperation
            .then(async (prepared) => {
              await initialize();
              return completeGestureSensitive(prepared);
            })
            .catch((error) => publicRuntimeError(error));
        }
      } catch (error) {
        return Promise.resolve(publicRuntimeError(error));
      }
      return handleNormalMessage(message);
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
  chromeApi.tabs.onActivated.addListener(({ tabId }) => runtime.initialize()
    .then(() => runtime.badges.refreshTab(tabId))
    .catch((error) => {
      console.error("MDPS badge activation refresh failed", error);
    }));
  chromeApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status || changeInfo.url) {
      return runtime.initialize()
        .then(() => runtime.badges.refreshTab(tabId, changeInfo.url ?? tab?.url))
        .catch((error) => {
          console.error("MDPS badge navigation refresh failed", error);
        });
    }
  });
  chromeApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const operation = runtime.handleMessage(message);
    operation.then((response) => {
      try { sendResponse(response); } catch { /* Receiver closure never cancels the operation. */ }
    });
    return true;
  });
}
