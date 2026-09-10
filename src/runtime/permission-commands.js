import { exactOriginsForHost, inspectPermissionReadiness } from "../core/permissions.js";
import { PERMISSION_ERROR, PermissionError } from "../core/permission-error.js";
import { validateSite, validateSiteId } from "../core/sites.js";
import { MESSAGE_TYPE } from "./runtime.js";
import { RUNTIME_ERROR, RuntimeError } from "./runtime-error.js";

const PLACEHOLDER_SITE_ID = "00000000-0000-4000-8000-000000000000";
const GESTURE_TYPES = new Set([
  MESSAGE_TYPE.CREATE_SITE_WITH_PERMISSION,
  MESSAGE_TYPE.UPDATE_SITE_WITH_PERMISSION,
  MESSAGE_TYPE.GRANT_SITE_ACCESS,
]);

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, `${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
    throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, `${label} fields are invalid.`);
  }
}

function canonicalSiteInput(input, { update }) {
  const expected = update ? ["siteId", "name", "profile", "hosts"] : ["name", "profile", "hosts"];
  assertExactKeys(input, expected, update ? "Update Site" : "Create Site");
  if (!Array.isArray(input.hosts)) {
    throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, "Site hosts must be an array.");
  }
  const id = update ? validateSiteId(input.siteId) : PLACEHOLDER_SITE_ID;
  const candidate = validateSite({
    id,
    name: input.name,
    profile: input.profile,
    hosts: input.hosts.map((hostname, index) => ({ hostname, ruleId: index + 1 })),
  });
  const canonicalHosts = candidate.hosts.map((host) => host.hostname);
  if (canonicalHosts.some((hostname, index) => hostname !== input.hosts[index])) {
    throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, "Permission hosts must already be canonical.");
  }
  return Object.freeze({
    ...(update ? { siteId: candidate.id } : {}),
    name: candidate.name,
    profile: candidate.profile,
    hosts: Object.freeze(canonicalHosts),
  });
}

function expectedRevision(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, "Expected revision is invalid.");
  }
  return value;
}

function canonicalHostHint(hosts, candidateHosts, { allowEmpty }) {
  if (!Array.isArray(hosts) || (!allowEmpty && hosts.length === 0)) {
    throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, "Permission host hint is invalid.");
  }
  const owner = new Set(candidateHosts);
  const canonical = hosts.map((hostname, index) => {
    const checked = validateSite({
      id: PLACEHOLDER_SITE_ID,
      name: "Permission host",
      profile: "default",
      hosts: [{ hostname, ruleId: index + 1 }],
    }).hosts[0].hostname;
    if (checked !== hostname || !owner.has(checked)) {
      throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, "Permission host hint is unrelated or non-canonical.");
    }
    return checked;
  });
  if (new Set(canonical).size !== canonical.length) {
    throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, "Permission host hint contains duplicates.");
  }
  return Object.freeze(canonical);
}

function prepare(message) {
  assertExactKeys(message, ["type", "payload"], "Permission command");
  const payload = message.payload;
  switch (message.type) {
    case MESSAGE_TYPE.CREATE_SITE_WITH_PERMISSION: {
      assertExactKeys(payload, ["expectedRevision", "site"], "Create payload");
      const site = canonicalSiteInput(payload.site, { update: false });
      return Object.freeze({ type: message.type, expectedRevision: expectedRevision(payload.expectedRevision), site, permissionHosts: site.hosts });
    }
    case MESSAGE_TYPE.UPDATE_SITE_WITH_PERMISSION: {
      assertExactKeys(payload, ["expectedRevision", "site", "addedHosts"], "Update payload");
      const site = canonicalSiteInput(payload.site, { update: true });
      const addedHosts = canonicalHostHint(payload.addedHosts, site.hosts, { allowEmpty: false });
      return Object.freeze({ type: message.type, expectedRevision: expectedRevision(payload.expectedRevision), site, addedHosts, permissionHosts: addedHosts });
    }
    case MESSAGE_TYPE.GRANT_SITE_ACCESS: {
      assertExactKeys(payload, ["expectedRevision", "siteId", "hosts", "currentTabId"], "Grant payload");
      const siteId = validateSiteId(payload.siteId);
      const hosts = canonicalHostHint(payload.hosts, payload.hosts, { allowEmpty: false });
      if (payload.currentTabId !== null && (!Number.isInteger(payload.currentTabId) || payload.currentTabId < 0)) {
        throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, "Current tab ID is invalid.");
      }
      return Object.freeze({ type: message.type, expectedRevision: expectedRevision(payload.expectedRevision), siteId, hosts, currentTabId: payload.currentTabId, permissionHosts: hosts });
    }
    default:
      return null;
  }
}

async function requirePostCondition(prepared, requestAccepted, permissions) {
  if (requestAccepted !== true) {
    throw new PermissionError(PERMISSION_ERROR.DENIED, "Site access was not granted.");
  }
  const readiness = inspectPermissionReadiness(await permissions.inspectHosts(prepared.permissionHosts));
  if (!readiness.ready) {
    throw new PermissionError(
      PERMISSION_ERROR.POST_CONDITION_FAILURE,
      "Granted site access did not satisfy the exact-host post-condition.",
      { missingHosts: readiness.missingHosts },
    );
  }
  return prepared;
}

export function startGestureSensitivePermissionCommand(message, permissions) {
  if (!message || typeof message !== "object" || !GESTURE_TYPES.has(message.type)) return null;
  const prepared = prepare(message);
  const origins = prepared.permissionHosts.flatMap(exactOriginsForHost);
  // This must remain the first asynchronous/Chrome API effect after synchronous validation.
  const requestPromise = permissions.requestOrigins(origins);
  return Promise.resolve(requestPromise).then(
    (accepted) => requirePostCondition(prepared, accepted, permissions),
  );
}

export function isGestureSensitiveMessageType(type) {
  return GESTURE_TYPES.has(type);
}
