import { normalizeHostInput } from "./hosts.js";
import { validateSite, validateSiteCollection } from "./sites.js";
import { PERMISSION_ERROR, PermissionError } from "./permission-error.js";

export const PERMISSION_STATE = Object.freeze({
  FULLY_GRANTED: "fully_granted",
  PARTIAL_HTTPS: "partial_https",
  PARTIAL_HTTP: "partial_http",
  NOT_GRANTED: "not_granted",
});

export const PERMISSION_DECISION = Object.freeze({
  READY: "ready",
  DENIED: "denied",
  PARTIAL: "partial",
  API_FAILURE: "api_failure",
  REMOVED: "removed",
  REMOVE_FAILED: "remove_failed",
  POST_CONDITION_FAILED: "post_condition_failed",
});

export const SITE_PERMISSION_STATUS = Object.freeze({
  READY: "ready",
  PARTIAL: "permission_partial",
  MISSING_OR_REVOKED: "permission_missing_or_revoked",
});

function permissionError(code, message, details = {}, cause) {
  return new PermissionError(code, message, details, cause ? { cause } : {});
}

function assertCanonicalHostname(hostname) {
  if (typeof hostname !== "string") {
    throw permissionError(PERMISSION_ERROR.INVALID_HOST, "Permission host must be canonical.");
  }
  let normalized;
  try {
    normalized = normalizeHostInput(hostname);
  } catch (cause) {
    throw permissionError(
      PERMISSION_ERROR.INVALID_HOST,
      "Permission host is invalid.",
      { hostname },
      cause,
    );
  }
  if (normalized !== hostname) {
    throw permissionError(
      PERMISSION_ERROR.INVALID_HOST,
      "Permission host must already be canonical.",
      { hostname },
    );
  }
  return hostname;
}

export function exactOriginsForHost(hostname) {
  const canonical = assertCanonicalHostname(hostname);
  return Object.freeze([
    `https://${canonical}/*`,
    `http://${canonical}/*`,
  ]);
}

function unique(values) {
  return Object.freeze([...new Set(values)]);
}

function assertPlanOrigins(hostnames, origins, { allowSubset = false } = {}) {
  const allowed = new Set(hostnames.flatMap(exactOriginsForHost));
  if (
    !Array.isArray(origins) ||
    new Set(origins).size !== origins.length ||
    origins.some((origin) => typeof origin !== "string" || !allowed.has(origin)) ||
    (!allowSubset && origins.length !== allowed.size)
  ) {
    throw permissionError(
      PERMISSION_ERROR.INVALID_HOST,
      "Permission plan contains a non-exact or unrelated origin.",
    );
  }
}

function validateAcquisitionPlan(plan) {
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.hostnames)) {
    throw permissionError(PERMISSION_ERROR.INVALID_HOST, "Permission plan is invalid.");
  }
  const hosts = plan.hostnames.map(assertCanonicalHostname);
  if (new Set(hosts).size !== hosts.length) {
    throw permissionError(PERMISSION_ERROR.INVALID_HOST, "Permission plan repeats a host.");
  }
  assertPlanOrigins(hosts, plan.origins);
  assertPlanOrigins(hosts, plan.requestOrigins, { allowSubset: true });
  assertPlanOrigins(hosts, plan.priorGrantedOrigins, { allowSubset: true });
  const covered = new Set([...plan.requestOrigins, ...plan.priorGrantedOrigins]);
  if (covered.size !== plan.origins.length || plan.origins.some((origin) => !covered.has(origin))) {
    throw permissionError(PERMISSION_ERROR.INVALID_HOST, "Permission plan is incomplete.");
  }
  return plan;
}

function validateReleasePlan(plan) {
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.hostnames)) {
    throw permissionError(PERMISSION_ERROR.INVALID_HOST, "Permission release plan is invalid.");
  }
  const hosts = plan.hostnames.map(assertCanonicalHostname);
  if (new Set(hosts).size !== hosts.length) {
    throw permissionError(PERMISSION_ERROR.INVALID_HOST, "Permission release plan repeats a host.");
  }
  assertPlanOrigins(hosts, plan.origins);
  return plan;
}

export function permissionStateFromGrants({ https, http }) {
  if (https === true && http === true) return PERMISSION_STATE.FULLY_GRANTED;
  if (https === true && http === false) return PERMISSION_STATE.PARTIAL_HTTPS;
  if (https === false && http === true) return PERMISSION_STATE.PARTIAL_HTTP;
  if (https === false && http === false) return PERMISSION_STATE.NOT_GRANTED;
  throw permissionError(
    PERMISSION_ERROR.API_FAILURE,
    "Permission inspection must provide boolean HTTP and HTTPS grants.",
  );
}

export function createHostPermissionInspection(hostname, grants) {
  const [httpsOrigin, httpOrigin] = exactOriginsForHost(hostname);
  const state = permissionStateFromGrants(grants);
  return Object.freeze({
    hostname,
    state,
    fullyGranted: state === PERMISSION_STATE.FULLY_GRANTED,
    grants: Object.freeze({
      https: grants.https,
      http: grants.http,
    }),
    missingOrigins: unique([
      ...(grants.https ? [] : [httpsOrigin]),
      ...(grants.http ? [] : [httpOrigin]),
    ]),
  });
}

export function createPermissionAcquisitionPlan(hostnames, inspections) {
  if (!Array.isArray(hostnames)) {
    throw permissionError(PERMISSION_ERROR.INVALID_HOST, "Host list must be an array.");
  }
  const canonicalHosts = unique(hostnames.map(assertCanonicalHostname));
  if (!Array.isArray(inspections)) {
    throw permissionError(
      PERMISSION_ERROR.API_FAILURE,
      "Permission planning requires a pre-request inspection for every host.",
    );
  }
  const byHost = new Map(inspections.map((inspection) => [inspection.hostname, inspection]));
  if (
    inspections.length !== canonicalHosts.length ||
    byHost.size !== canonicalHosts.length ||
    canonicalHosts.some((hostname) => !byHost.has(hostname))
  ) {
    throw permissionError(
      PERMISSION_ERROR.API_FAILURE,
      "Permission planning requires exactly one inspection per host.",
    );
  }
  const missingOrigins = [];
  const priorGrantedOrigins = [];

  for (const hostname of canonicalHosts) {
    const inspection = byHost.get(hostname);
    for (const origin of exactOriginsForHost(hostname)) {
      if (inspection.missingOrigins.includes(origin)) missingOrigins.push(origin);
      else priorGrantedOrigins.push(origin);
    }
  }

  return Object.freeze({
    hostnames: canonicalHosts,
    origins: unique(canonicalHosts.flatMap(exactOriginsForHost)),
    requestOrigins: unique(missingOrigins),
    priorGrantedOrigins: unique(priorGrantedOrigins),
  });
}

export function planSiteCreatePermissions(site, inspections) {
  const canonical = validateSite(site);
  return createPermissionAcquisitionPlan(
    canonical.hosts.map((host) => host.hostname),
    inspections,
  );
}

export function planSiteEditPermissions(currentSite, candidateSite, inspections) {
  const current = validateSite(currentSite);
  const candidate = validateSite(candidateSite);
  if (current.id !== candidate.id) {
    throw permissionError(PERMISSION_ERROR.INVALID_HOST, "A Site edit cannot change its ID.");
  }
  const existing = new Set(current.hosts.map((host) => host.hostname));
  const addedHosts = candidate.hosts
    .map((host) => host.hostname)
    .filter((hostname) => !existing.has(hostname));
  return createPermissionAcquisitionPlan(addedHosts, inspections);
}

export function planPermissionRelease(beforeSites, afterSites) {
  const before = validateSiteCollection(beforeSites);
  const after = validateSiteCollection(afterSites);
  const retained = new Set(
    after.flatMap((site) => site.hosts.map((host) => host.hostname)),
  );
  const releasedHosts = unique(
    before
      .flatMap((site) => site.hosts.map((host) => host.hostname))
      .filter((hostname) => !retained.has(hostname)),
  );
  return Object.freeze({
    hostnames: releasedHosts,
    origins: unique(releasedHosts.flatMap(exactOriginsForHost)),
  });
}

export function inspectPermissionReadiness(inspections) {
  const missing = inspections.filter((item) => !item.fullyGranted);
  return Object.freeze({
    ready: missing.length === 0,
    inspections: Object.freeze([...inspections]),
    missingHosts: Object.freeze(missing.map((item) => item.hostname)),
    reason:
      missing.length === 0
        ? null
        : missing.some((item) => item.state.startsWith("partial_"))
          ? PERMISSION_ERROR.PARTIAL
          : PERMISSION_ERROR.DENIED,
  });
}

export async function inspectStoredSitePermissions(sites, port) {
  const canonical = validateSiteCollection(sites);
  const hostnames = unique(
    canonical.flatMap((site) => site.hosts.map((host) => host.hostname)),
  );
  const inspections = await port.inspectHosts(hostnames);
  const readiness = inspectPermissionReadiness(inspections);
  const status = readiness.ready
    ? SITE_PERMISSION_STATUS.READY
    : inspections.some((item) => item.state.startsWith("partial_"))
      ? SITE_PERMISSION_STATUS.PARTIAL
      : SITE_PERMISSION_STATUS.MISSING_OR_REVOKED;
  return Object.freeze({ status, ...readiness });
}

async function safeCleanupNewGrants(plan, afterInspections, port) {
  const prior = new Set(plan.priorGrantedOrigins);
  const newlyGranted = [];
  for (const inspection of afterInspections) {
    const origins = exactOriginsForHost(inspection.hostname);
    if (inspection.grants.https && !prior.has(origins[0])) newlyGranted.push(origins[0]);
    if (inspection.grants.http && !prior.has(origins[1])) newlyGranted.push(origins[1]);
  }
  if (newlyGranted.length === 0) return Object.freeze([]);
  try {
    await port.removeOrigins(unique(newlyGranted));
  } catch {
    // The decision still denies the Site mutation and exposes cleanupRequired.
    return null;
  }
  return unique(newlyGranted);
}

export function executePermissionRequest(plan, port) {
  validateAcquisitionPlan(plan);
  // This is intentionally the first effect. Call this function directly from a user gesture.
  const requestPromise = plan.requestOrigins.length === 0
    ? Promise.resolve(true)
    : port.requestOrigins(plan.requestOrigins);

  return Promise.resolve(requestPromise).then(async (requestAccepted) => {
    let inspections;
    try {
      inspections = await port.inspectHosts(plan.hostnames);
    } catch (cause) {
      throw permissionError(
        PERMISSION_ERROR.API_FAILURE,
        "Permission post-check failed.",
        { phase: "post_request" },
        cause,
      );
    }
    const readiness = inspectPermissionReadiness(inspections);
    if (requestAccepted === true && readiness.ready) {
      return Object.freeze({
        decision: PERMISSION_DECISION.READY,
        proceed: true,
        cleanupRequired: false,
        readiness,
      });
    }

    const cleanedOrigins = await safeCleanupNewGrants(plan, inspections, port);
    return Object.freeze({
      decision:
        requestAccepted === false
          ? PERMISSION_DECISION.DENIED
          : PERMISSION_DECISION.POST_CONDITION_FAILED,
      proceed: false,
      cleanupRequired: cleanedOrigins === null,
      cleanedOrigins,
      readiness,
      reason:
        requestAccepted === false
          ? PERMISSION_ERROR.DENIED
          : PERMISSION_ERROR.POST_CONDITION_FAILURE,
    });
  });
}

export async function executePermissionRelease(plan, port) {
  validateReleasePlan(plan);
  if (plan.origins.length === 0) {
    return Object.freeze({ decision: PERMISSION_DECISION.REMOVED, released: true });
  }
  let removed;
  try {
    removed = await port.removeOrigins(plan.origins);
  } catch (cause) {
    throw permissionError(
      PERMISSION_ERROR.REMOVAL_FAILURE,
      "Permission removal API failed.",
      {},
      cause,
    );
  }
  if (removed !== true) {
    return Object.freeze({
      decision: PERMISSION_DECISION.REMOVE_FAILED,
      released: false,
      reason: PERMISSION_ERROR.REMOVAL_FAILURE,
    });
  }
  let inspections;
  try {
    inspections = await port.inspectHosts(plan.hostnames);
  } catch (cause) {
    throw permissionError(
      PERMISSION_ERROR.POST_CONDITION_FAILURE,
      "Permission removal post-check failed.",
      { phase: "post_remove" },
      cause,
    );
  }
  const remaining = inspections.filter(
    (inspection) => inspection.state !== PERMISSION_STATE.NOT_GRANTED,
  );
  if (remaining.length > 0) {
    return Object.freeze({
      decision: PERMISSION_DECISION.POST_CONDITION_FAILED,
      released: false,
      reason: PERMISSION_ERROR.POST_CONDITION_FAILURE,
      remainingHosts: Object.freeze(remaining.map((item) => item.hostname)),
    });
  }
  return Object.freeze({
    decision: PERMISSION_DECISION.REMOVED,
    released: true,
  });
}
