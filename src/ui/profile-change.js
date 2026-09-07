export async function completePopupStateChange({
  performChange,
  tabId,
  shouldReload,
  refreshState,
  reloadTab,
}) {
  await performChange();
  try {
    await refreshState();
  } catch {
    return Object.freeze({ committed: true, reloaded: false, warning: "refresh_failed" });
  }

  if (!shouldReload) {
    return Object.freeze({ committed: true, reloaded: false, warning: null });
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

export async function applyCurrentSiteProfile({
  siteId,
  profile,
  expectedRevision,
  tabId,
  commitProfile,
  refreshState,
  reloadTab,
}) {
  return completePopupStateChange({
    performChange: () => commitProfile({ expectedRevision, siteId, profile }),
    tabId,
    shouldReload: true,
    refreshState,
    reloadTab,
  });
}
