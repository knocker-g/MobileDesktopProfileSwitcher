import { configurationOf, OPERATION_KIND, validatePersistedState } from "../core/storage-schema.js";
import { createMutationExecutor } from "../core/transaction.js";
import { executePermissionRelease, inspectPermissionReadiness, planPermissionRelease } from "../core/permissions.js";
import { normalizeHostInputs } from "../core/hosts.js";
import { RUNTIME_ERROR, RuntimeError } from "./runtime-error.js";
import { TRANSACTION_ERROR, TransactionError } from "../core/transaction-error.js";
import {
  createSiteMutation,
  deleteSiteMutation,
  setEnabledMutation,
  setProfileMutation,
  updateSiteMutation,
} from "./site-mutations.js";

function hostsOfSiteInput(input) {
  if (!input || !Array.isArray(input.hosts)) throw new TypeError("Site hosts are required.");
  const values = input.hosts.map((entry) => typeof entry === "string" ? entry : entry.hostname);
  const normalized = normalizeHostInputs(values);
  if (normalized.duplicates.length > 0) throw new TypeError("Site contains duplicate hosts.");
  return normalized.hosts;
}

export function createRuntimeBackend({ storage, derivedState, permissions, createMutationId, createSiteId }) {
  const executor = createMutationExecutor({ storage, derivedState, createMutationId });

  async function current() {
    return validatePersistedState(await storage.readState());
  }

  async function requirePermissions(hostnames) {
    const readiness = inspectPermissionReadiness(await permissions.inspectHosts(hostnames));
    if (!readiness.ready) {
      throw new RuntimeError(RUNTIME_ERROR.PERMISSION_REQUIRED, "All exact-host permissions are required.", {
        missingHosts: readiness.missingHosts,
        reason: readiness.reason,
      });
    }
  }

  async function mutate(expectedRevision, operationKind, mutation, permissionHosts = []) {
    if (permissionHosts.length > 0) await requirePermissions(permissionHosts);
    return executor.execute({ expectedRevision, operationKind, mutate: mutation });
  }

  async function mutateAndRelease(expectedRevision, operationKind, mutation) {
    const before = await current();
    const committed = await mutate(expectedRevision, operationKind, mutation);
    const plan = planPermissionRelease(before.sites, committed.sites);
    let permissionCleanup = null;
    if (plan.origins.length > 0) {
      try {
        permissionCleanup = await executePermissionRelease(plan, permissions);
      } catch (error) {
        permissionCleanup = { warning: RUNTIME_ERROR.PERMISSION_CLEANUP_REQUIRED, message: error.message };
      }
    }
    return Object.freeze({ state: committed, permissionCleanup, releasePlan: plan });
  }

  function assertExpectedRevision(expectedRevision, state) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== state.revision) {
      throw new TransactionError(
        TRANSACTION_ERROR.STALE_REVISION,
        "Mutation expected revision does not match current revision.",
        { expectedRevision, actualRevision: state.revision },
      );
    }
  }

  function sameHosts(left, right) {
    return left.length === right.length && left.every((hostname, index) => hostname === right[index]);
  }

  return Object.freeze({
    getState: current,
    inspectPermissions: async () => {
      const state = await current();
      return permissions.inspectHosts(state.sites.flatMap((site) => site.hosts.map((host) => host.hostname)));
    },
    createSite: async ({ expectedRevision, site }) => {
      const hostnames = hostsOfSiteInput(site);
      return mutate(expectedRevision, OPERATION_KIND.CREATE_SITE,
        (state) => createSiteMutation(state, site, createSiteId), hostnames);
    },
    updateSite: async ({ expectedRevision, site }) => {
      const before = await current();
      const old = before.sites.find((item) => item.id === site.siteId);
      const oldHosts = new Set(old?.hosts.map((host) => host.hostname) ?? []);
      const added = hostsOfSiteInput(site).filter((host) => !oldHosts.has(host));
      await requirePermissions(added);
      return mutateAndRelease(expectedRevision, OPERATION_KIND.UPDATE_SITE,
        (state) => updateSiteMutation(state, site));
    },
    updateSiteWithPermission: async ({ expectedRevision, site, addedHosts }) => {
      const before = await current();
      assertExpectedRevision(expectedRevision, before);
      const old = before.sites.find((item) => item.id === site.siteId);
      if (!old) throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, "Site was not found for permission verification.");
      const existing = new Set(old.hosts.map((host) => host.hostname));
      const actualAdded = hostsOfSiteInput(site).filter((hostname) => !existing.has(hostname));
      if (!sameHosts(actualAdded, addedHosts)) {
        throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, "Added host hint does not match canonical storage state.");
      }
      await requirePermissions(actualAdded);
      return mutateAndRelease(expectedRevision, OPERATION_KIND.UPDATE_SITE,
        (state) => updateSiteMutation(state, site));
    },
    grantSiteAccess: async ({ expectedRevision, siteId, hosts }) => {
      const state = await current();
      assertExpectedRevision(expectedRevision, state);
      const site = state.sites.find((item) => item.id === siteId);
      if (!site) throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, "Site was not found for permission verification.");
      const actualHosts = site.hosts.map((host) => host.hostname);
      if (!sameHosts(actualHosts, hosts)) {
        throw new RuntimeError(RUNTIME_ERROR.INVALID_MESSAGE, "Permission host hint does not match canonical storage state.");
      }
      await requirePermissions(actualHosts);
      const reconciliation = await derivedState.reconcile(state);
      return Object.freeze({ state, reconciliation });
    },
    deleteSite: ({ expectedRevision, siteId }) => mutateAndRelease(
      expectedRevision, OPERATION_KIND.REMOVE_SITE, (state) => deleteSiteMutation(state, siteId)),
    setProfile: ({ expectedRevision, siteId, profile }) => mutate(
      expectedRevision, OPERATION_KIND.SET_PROFILE, (state) => setProfileMutation(state, siteId, profile)),
    setEnabled: ({ expectedRevision, enabled }) => mutate(
      expectedRevision, OPERATION_KIND.SET_ENABLED, (state) => setEnabledMutation(state, enabled)),
    configuration: async () => configurationOf(await current()),
  });
}
