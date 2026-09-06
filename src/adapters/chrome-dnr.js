import { DNR_ERROR, DnrError } from "../core/dnr-error.js";

function apiError(operation, cause) {
  return new DnrError(
    DNR_ERROR.API_FAILURE,
    `Chrome DNR ${operation} failed.`,
    { operation },
    { cause },
  );
}

export function createChromeDnrAdapter(dnrApi) {
  if (!dnrApi || typeof dnrApi !== "object") throw new TypeError("A DNR API object is required.");
  return Object.freeze({
    async getDynamicRules() {
      try {
        return await dnrApi.getDynamicRules();
      } catch (cause) {
        throw apiError("getDynamicRules", cause);
      }
    },
    async updateDynamicRules(change) {
      try {
        await dnrApi.updateDynamicRules(change);
      } catch (cause) {
        throw apiError("updateDynamicRules", cause);
      }
    },
  });
}
