export function createActiveTabAdapter(tabsApi) {
  if (!tabsApi || typeof tabsApi.query !== "function") {
    throw new TypeError("A tabs API object is required.");
  }

  return Object.freeze({
    async getCurrentUrl() {
      const tabs = await tabsApi.query({ active: true, currentWindow: true });
      const tab = Array.isArray(tabs) ? tabs[0] : undefined;
      return typeof tab?.url === "string" ? tab.url : null;
    },
  });
}
