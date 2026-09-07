export async function applyCurrentSiteProfile({
  siteId,
  profile,
  expectedRevision,
  tabId,
  commitProfile,
  refreshState,
  reloadTab,
}) {
  await commitProfile({ expectedRevision, siteId, profile });
  try {
    await refreshState();
  } catch {
    return Object.freeze({ committed: true, reloaded: false, warning: "refresh_failed" });
  }

  if (!Number.isInteger(tabId) || tabId < 0) {
    return Object.freeze({ committed: true, reloaded: false, warning: "reload_unavailable" });
  }

  try {
    await reloadTab(tabId);
    return Object.freeze({ committed: true, reloaded: true, warning: null });
  } catch {
    return Object.freeze({ committed: true, reloaded: false, warning: "reload_failed" });
  }
}
