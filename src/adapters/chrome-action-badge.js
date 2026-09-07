const BADGE_COLORS = Object.freeze({ D: "#1769e0", M: "#13795b", "-": "#5f6368", OFF: "#5f6368", "": "#5f6368" });

export function createChromeActionBadgeAdapter(actionApi) {
  if (!actionApi || typeof actionApi.setBadgeText !== "function") {
    throw new TypeError("A Chrome action API object is required.");
  }
  return Object.freeze({
    async set(tabId, text) {
      const details = Number.isInteger(tabId) ? { tabId, text } : { text };
      await actionApi.setBadgeText(details);
      if (text && typeof actionApi.setBadgeBackgroundColor === "function") {
        await actionApi.setBadgeBackgroundColor(Number.isInteger(tabId)
          ? { tabId, color: BADGE_COLORS[text] }
          : { color: BADGE_COLORS[text] });
      }
    },
  });
}
