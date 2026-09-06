export { DOMAIN_ERROR, DomainValidationError } from "./domain-error.js";
export { normalizeHostInput, normalizeHostInputs } from "./hosts.js";
export {
  PROFILE,
  PROFILE_VALUES,
  VERIFIED_PROFILE_SET,
  userAgentForProfile,
} from "./profiles.js";
export {
  addSiteCandidate,
  removeSiteCandidate,
  updateSiteCandidate,
  validateProfile,
  validateSite,
  validateSiteCollection,
  validateSiteId,
} from "./sites.js";
export {
  RECOVERY_ACTION,
  decideStartupRecovery,
  recoverAtStartup,
} from "./recovery.js";
export {
  CURRENT_SCHEMA_VERSION,
  OPERATION_KIND,
  SCHEMA_STATUS,
  classifySchemaVersion,
  configurationOf,
  createDefaultState,
  createPendingMutation,
  inspectPersistedState,
  stateWithPending,
  validatePersistedState,
} from "./storage-schema.js";
export { createMutationExecutor } from "./transaction.js";
export { TRANSACTION_ERROR, TransactionError } from "./transaction-error.js";
export { PERMISSION_ERROR, PermissionError } from "./permission-error.js";
export {
  PERMISSION_DECISION,
  PERMISSION_STATE,
  SITE_PERMISSION_STATUS,
  createHostPermissionInspection,
  createPermissionAcquisitionPlan,
  exactOriginsForHost,
  executePermissionRelease,
  executePermissionRequest,
  inspectPermissionReadiness,
  inspectStoredSitePermissions,
  permissionStateFromGrants,
  planPermissionRelease,
  planSiteCreatePermissions,
  planSiteEditPermissions,
} from "./permissions.js";
export { DNR_ERROR, DnrError } from "./dnr-error.js";
export {
  DNR_RULE_PRIORITY,
  MAX_UNSAFE_DYNAMIC_RULES,
  createUserAgentRule,
  diffDynamicRules,
  exactHostUrlFilter,
  generateExpectedRules,
  matchesExactHostScope,
  rulesEqual,
} from "./dnr-rules.js";
export { MAX_DNR_RULE_ID, allocateRuleIds } from "./rule-ids.js";
