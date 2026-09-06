import { exactOriginsForHost, inspectPermissionReadiness } from "../core/permissions.js";

export function requestExactHostAccess(hostnames, permissionPort) {
  const origins = [...new Set(hostnames.flatMap(exactOriginsForHost))];
  if (origins.length === 0) return Promise.resolve(true);
  // Deliberately invoke requestOrigins before any asynchronous work.
  const requestPromise = permissionPort.requestOrigins(origins);
  return Promise.resolve(requestPromise).then(async (accepted) => {
    const readiness = inspectPermissionReadiness(await permissionPort.inspectHosts(hostnames));
    return accepted === true && readiness.ready;
  });
}
