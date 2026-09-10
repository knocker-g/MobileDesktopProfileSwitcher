const ORIGIN = "https://example.com/*";
let recentEvents = ["Service worker started"];
let lastError = null;

function record(message) {
  recentEvents = [...recentEvents.slice(-7), message];
}

async function badgeText() {
  return chrome.action.getBadgeText({});
}

async function snapshot(summary) {
  const granted = await chrome.permissions.contains({ origins: [ORIGIN] });
  const text = await badgeText();
  return {
    summary,
    granted,
    continuationReached: text === "OK",
    badgeText: text,
    events: [...recentEvents, ...(lastError ? [`Error: ${lastError}`] : [])],
  };
}

function requestFromServiceWorker() {
  record("1. Message received");
  record("2. permissions.request started");
  // Intentionally start the API request synchronously in the message handler.
  const requestPromise = chrome.permissions.request({ origins: [ORIGIN] });
  chrome.action.setBadgeText({ text: "REQ" });
  chrome.action.setBadgeBackgroundColor({ color: "#6b7280" });
  return Promise.resolve(requestPromise).then(async (accepted) => {
    record(`3. permissions.request resolved: ${accepted}`);
    record("4. permissions.contains started");
    const granted = await chrome.permissions.contains({ origins: [ORIGIN] });
    record(`5. permissions.contains result: ${granted}`);
    if (accepted === true && granted === true) {
      record("6. Post-request continuation reached");
      await chrome.action.setBadgeText({ text: "OK" });
      await chrome.action.setBadgeBackgroundColor({ color: "#16794b" });
      return snapshot("PASS evidence recorded: permission granted and SW continuation reached.");
    }
    await chrome.action.setBadgeText({ text: "NO" });
    await chrome.action.setBadgeBackgroundColor({ color: "#9b2c2c" });
    return snapshot("Permission was not granted or its post-condition failed.");
  }).catch(async (error) => {
    lastError = error instanceof Error ? error.message : String(error);
    record("3. permissions.request rejected");
    await chrome.action.setBadgeText({ text: "ERR" });
    await chrome.action.setBadgeBackgroundColor({ color: "#9b2c2c" });
    return snapshot("Service Worker permission request failed.");
  });
}

async function removePermission() {
  record("Remove started");
  lastError = null;
  const removed = await chrome.permissions.remove({ origins: [ORIGIN] });
  const granted = await chrome.permissions.contains({ origins: [ORIGIN] });
  record(`Remove result: ${removed}; contains: ${granted}`);
  await chrome.action.setBadgeText({ text: "" });
  return snapshot(granted ? "Reset failed: permission remains granted." : "Reset complete.");
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  let operation;
  if (message?.type === "REQUEST_PERMISSION_FROM_SW") operation = requestFromServiceWorker();
  else if (message?.type === "CHECK_STATUS") operation = snapshot("Current probe evidence.");
  else if (message?.type === "REMOVE_PERMISSION") operation = removePermission();
  else operation = Promise.resolve({ summary: "Unknown command.", granted: false, continuationReached: false, badgeText: "", events: [...recentEvents] });
  operation.then(sendResponse);
  return true;
});
