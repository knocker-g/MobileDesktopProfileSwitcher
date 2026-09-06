import {
  createHostPermissionInspection,
  exactOriginsForHost,
} from "../core/permissions.js";
import { PERMISSION_ERROR, PermissionError } from "../core/permission-error.js";

function apiError(operation, cause) {
  return new PermissionError(
    PERMISSION_ERROR.API_FAILURE,
    `Chrome permissions ${operation} failed.`,
    { operation },
    { cause },
  );
}

export function createChromePermissionsAdapter(permissionsApi) {
  if (!permissionsApi || typeof permissionsApi !== "object") {
    throw new TypeError("A permissions API object is required.");
  }

  function requestOrigins(origins) {
    // Keep the API invocation synchronous so the caller can preserve its user gesture.
    try {
      return Promise.resolve(permissionsApi.request({ origins })).catch((cause) => {
        throw apiError("request", cause);
      });
    } catch (cause) {
      return Promise.reject(apiError("request", cause));
    }
  }

  async function containsOrigin(origin) {
    try {
      return await permissionsApi.contains({ origins: [origin] });
    } catch (cause) {
      throw apiError("contains", cause);
    }
  }

  return Object.freeze({
    requestOrigins,

    async removeOrigins(origins) {
      try {
        return await permissionsApi.remove({ origins });
      } catch (cause) {
        throw apiError("remove", cause);
      }
    },

    async inspectHosts(hostnames) {
      return Promise.all(
        hostnames.map(async (hostname) => {
          const [httpsOrigin, httpOrigin] = exactOriginsForHost(hostname);
          const [https, http] = await Promise.all([
            containsOrigin(httpsOrigin),
            containsOrigin(httpOrigin),
          ]);
          return createHostPermissionInspection(hostname, { https, http });
        }),
      );
    },
  });
}
