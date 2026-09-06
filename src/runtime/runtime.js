import { createDefaultState, validatePersistedState } from "../core/storage-schema.js";
import { recoverAtStartup } from "../core/recovery.js";
import { RUNTIME_ERROR, RuntimeError } from "./runtime-error.js";

export const MESSAGE_TYPE = Object.freeze({
  GET_STATE: "get_state",
  INSPECT_PERMISSIONS: "inspect_permissions",
  CREATE_SITE: "create_site",
  UPDATE_SITE: "update_site",
  DELETE_SITE: "delete_site",
  SET_PROFILE: "set_profile",
  SET_ENABLED: "set_enabled",
  RECONCILE: "reconcile",
});

const ALLOWED = new Set(Object.values(MESSAGE_TYPE));

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
    throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, `${label} fields are invalid.`);
  }
}

function validatePayload(type, payload) {
  switch (type) {
    case MESSAGE_TYPE.GET_STATE:
    case MESSAGE_TYPE.INSPECT_PERMISSIONS:
    case MESSAGE_TYPE.RECONCILE:
      assertExactKeys(payload, [], "Command payload");
      break;
    case MESSAGE_TYPE.CREATE_SITE:
      assertExactKeys(payload, ["expectedRevision", "site"], "Create payload");
      assertExactKeys(payload.site ?? {}, ["name", "profile", "hosts"], "Create Site");
      break;
    case MESSAGE_TYPE.UPDATE_SITE:
      assertExactKeys(payload, ["expectedRevision", "site"], "Update payload");
      assertExactKeys(payload.site ?? {}, ["siteId", "name", "profile", "hosts"], "Update Site");
      break;
    case MESSAGE_TYPE.DELETE_SITE:
      assertExactKeys(payload, ["expectedRevision", "siteId"], "Delete payload");
      break;
    case MESSAGE_TYPE.SET_PROFILE:
      assertExactKeys(payload, ["expectedRevision", "siteId", "profile"], "Profile payload");
      break;
    case MESSAGE_TYPE.SET_ENABLED:
      assertExactKeys(payload, ["expectedRevision", "enabled"], "Enabled payload");
      break;
  }
  return payload;
}

function publicError(error) {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: error?.code ?? RUNTIME_ERROR.INITIALIZATION_FAILED,
      message: error instanceof Error ? error.message : "Runtime operation failed.",
      details: error?.details ?? {},
    }),
  });
}

export async function initializeRuntime({ storage, derivedState }) {
  let raw;
  try {
    raw = await storage.readState();
    if (raw === undefined) {
      const initial = createDefaultState();
      await storage.writeState(initial);
      await derivedState.apply(initial);
      return Object.freeze({ initialized: true, firstRun: true, state: initial });
    }
    const decision = await recoverAtStartup({ storage, derivedState });
    return Object.freeze({ initialized: true, firstRun: false, recovery: decision });
  } catch (cause) {
    try {
      await derivedState.failClosed("runtime_initialization_failure");
    } catch (failClosedCause) {
      throw new RuntimeError(
        RUNTIME_ERROR.INITIALIZATION_FAILED,
        "Runtime initialization and fail-closed cleanup failed.",
        { failClosedFailed: true, preserveRawState: true },
        { cause: failClosedCause },
      );
    }
    throw cause;
  }
}

export function createRuntimeMessageHandler({ backend, derivedState }) {
  return async function handleMessage(message) {
    try {
      if (!message || typeof message !== "object" || Array.isArray(message)) {
        throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, "Message must be an object.");
      }
      if (typeof message.type !== "string" || !ALLOWED.has(message.type)) {
        throw new RuntimeError(RUNTIME_ERROR.UNKNOWN_COMMAND, "Unknown runtime command.");
      }
      const payload = message.payload ?? {};
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, "Message payload must be an object.");
      }
      validatePayload(message.type, payload);

      let value;
      switch (message.type) {
        case MESSAGE_TYPE.GET_STATE: value = await backend.getState(); break;
        case MESSAGE_TYPE.INSPECT_PERMISSIONS: value = await backend.inspectPermissions(); break;
        case MESSAGE_TYPE.CREATE_SITE: value = await backend.createSite(payload); break;
        case MESSAGE_TYPE.UPDATE_SITE: value = await backend.updateSite(payload); break;
        case MESSAGE_TYPE.DELETE_SITE: value = await backend.deleteSite(payload); break;
        case MESSAGE_TYPE.SET_PROFILE: value = await backend.setProfile(payload); break;
        case MESSAGE_TYPE.SET_ENABLED: value = await backend.setEnabled(payload); break;
        case MESSAGE_TYPE.RECONCILE: value = await derivedState.reconcile(await backend.getState()); break;
      }
      return Object.freeze({ ok: true, value });
    } catch (error) {
      return publicError(error);
    }
  };
}

export function assertRuntimeState(value) {
  return validatePersistedState(value);
}
