export function createActiveTabAdapter(tabsApi) {
  if (!tabsApi || typeof tabsApi.query !== "function") {
    throw new TypeError("A tabs API object is required.");
  }

  return Object.freeze({
    async getCurrentTab() {
      const tabs = await tabsApi.query({ active: true, currentWindow: true });
      const tab = Array.isArray(tabs) ? tabs[0] : undefined;
      return Object.freeze({
        id: Number.isInteger(tab?.id) ? tab.id : null,
        url: typeof tab?.url === "string" ? tab.url : null,
      });
    },
    async getCurrentUrl() {
      const tabs = await tabsApi.query({ active: true, currentWindow: true });
      const tab = Array.isArray(tabs) ? tabs[0] : undefined;
      return typeof tab?.url === "string" ? tab.url : null;
    },
    async reload(tabId) {
      if (!Number.isInteger(tabId) || tabId < 0) throw new TypeError("A valid tab ID is required.");
      if (typeof tabsApi.reload !== "function") throw new TypeError("The tabs reload API is unavailable.");
      await tabsApi.reload(tabId);
    },
  });
}
