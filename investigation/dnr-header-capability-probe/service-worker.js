"use strict";

const TARGET_URL_FILTER = "|http://localhost:8000/";
const RULE_ID = 1;

const MODES = [
  { id: "OFF", badge: "OFF", header: null, value: null },
  {
    id: "CAP-H-UA",
    badge: "UA",
    header: "user-agent",
    value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  },
  {
    id: "CAP-H-CH-UA",
    badge: "CH",
    header: "sec-ch-ua",
    value: '"Not/A)Brand";v="8", "Chromium";v="154", "Google Chrome";v="154"',
  },
  {
    id: "CAP-H-CH-Mobile",
    badge: "M0",
    header: "sec-ch-ua-mobile",
    value: "?0",
  },
  {
    id: "CAP-H-CH-Platform",
    badge: "WIN",
    header: "sec-ch-ua-platform",
    value: '"Windows"',
  },
];

function ruleFor(mode) {
  return {
    id: RULE_ID,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [{ header: mode.header, operation: "set", value: mode.value }],
    },
    condition: {
      urlFilter: TARGET_URL_FILTER,
      resourceTypes: ["main_frame"],
    },
  };
}

async function currentMode() {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  if (rules.length === 0) return MODES[0];
  const activeHeader = rules.find((rule) => rule.id === RULE_ID)
    ?.action?.requestHeaders?.[0]?.header?.toLowerCase();
  return MODES.find((mode) => mode.header === activeHeader) || MODES[0];
}

async function showMode(mode, errorMessage) {
  await chrome.action.setBadgeText({ text: errorMessage ? "ERR" : mode.badge });
  await chrome.action.setBadgeBackgroundColor({ color: errorMessage ? "#b3261e" : "#315da8" });
  await chrome.action.setTitle({
    title: errorMessage
      ? `CAP-H error: ${errorMessage}`
      : `CAP-H active mode: ${mode.id}. Click to select the next mode.`,
  });
}

async function selectNextMode() {
  const active = await currentMode();
  const next = MODES[(MODES.indexOf(active) + 1) % MODES.length];
  const update = { removeRuleIds: [RULE_ID] };
  if (next.header) update.addRules = [ruleFor(next)];

  try {
    await chrome.declarativeNetRequest.updateSessionRules(update);
    const accepted = await currentMode();
    if (accepted.id !== next.id) {
      throw new Error(`Requested ${next.id}, but active mode is ${accepted.id}.`);
    }
    await showMode(accepted);
    console.info("CAP-H mode accepted", { mode: accepted.id, header: accepted.header });
  } catch (error) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [RULE_ID] }).catch(() => {});
    const message = error instanceof Error ? error.message : String(error);
    await showMode(MODES[0], message);
    console.error("CAP-H mode rejected", { requestedMode: next.id, error: message });
  }
}

chrome.action.onClicked.addListener(() => {
  selectNextMode().catch((error) => console.error("CAP-H unexpected error", error));
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [RULE_ID] })
    .then(() => showMode(MODES[0]))
    .catch((error) => showMode(MODES[0], String(error)));
});

chrome.runtime.onStartup.addListener(() => {
  currentMode().then((mode) => showMode(mode)).catch((error) => showMode(MODES[0], String(error)));
});
