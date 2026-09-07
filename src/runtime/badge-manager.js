import { badgeTextForTab } from "../ui/badge-model.js";

export function createBadgeManager({ tabs, badge, backend }) {
  async function currentContext() {
    const [state, inspections] = await Promise.all([backend.getState(), backend.inspectPermissions()]);
    return { state, inspections };
  }

  async function refreshTab(tabId, knownUrl) {
    let url = knownUrl;
    if (typeof url !== "string" && Number.isInteger(tabId) && typeof tabs.get === "function") {
      try { url = (await tabs.get(tabId))?.url; }
      catch { url = null; }
    }
    const { state, inspections } = await currentContext();
    await badge.set(tabId, badgeTextForTab(state, url, inspections));
  }

  async function refreshAll() {
    const [openTabs, context] = await Promise.all([tabs.query({}), currentContext()]);
    await Promise.all(openTabs.map((tab) => badge.set(
      tab.id,
      badgeTextForTab(context.state, tab.url, context.inspections),
    )));
  }

  return Object.freeze({ refreshTab, refreshAll });
}
