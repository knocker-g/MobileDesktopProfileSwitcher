"use strict";

const RULE_ID = 1;
const WWW_TARGET_URL_FILTER = "|https://www.youtube.com/";
const UA_ONLY_DUAL_HOST_REGEX_FILTER = "^https://(www\\.youtube\\.com|m\\.youtube\\.com)/";

const FIXTURE = Object.freeze({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  chUa: '"Not/A)Brand";v="8", "Chromium";v="154", "Google Chrome";v="154"',
  chMobile: "?0",
  chPlatform: '"Windows"',
  mobileUserAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36",
});

const HEADER = Object.freeze({
  ua: { header: "user-agent", operation: "set", value: FIXTURE.userAgent },
  chUa: { header: "sec-ch-ua", operation: "set", value: FIXTURE.chUa },
  chMobile: { header: "sec-ch-ua-mobile", operation: "set", value: FIXTURE.chMobile },
  chPlatform: { header: "sec-ch-ua-platform", operation: "set", value: FIXTURE.chPlatform },
  mobileUa: { header: "user-agent", operation: "set", value: FIXTURE.mobileUserAgent },
});

const MODES = Object.freeze([
  { id: "OFF", badge: "OFF", headers: [] },
  { id: "A", badge: "A", headers: [HEADER.ua] },
  { id: "B", badge: "B", headers: [HEADER.ua, HEADER.chMobile] },
  { id: "C", badge: "C", headers: [HEADER.ua, HEADER.chMobile, HEADER.chPlatform] },
  { id: "D", badge: "D", headers: [HEADER.ua, HEADER.chMobile, HEADER.chPlatform, HEADER.chUa] },
  { id: "MOBILE", badge: "MOB", headers: [HEADER.mobileUa] },
]);

function ruleFor(mode) {
  const targetCondition = mode.id === "A" || mode.id === "MOBILE"
    ? { regexFilter: UA_ONLY_DUAL_HOST_REGEX_FILTER }
    : { urlFilter: WWW_TARGET_URL_FILTER };
  return {
    id: RULE_ID,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: mode.headers,
    },
    condition: {
      ...targetCondition,
      resourceTypes: ["main_frame"],
    },
  };
}

function modeForRule(rule) {
  if (!rule) return MODES[0];
  const activeHeaders = rule.action?.requestHeaders || [];
  return MODES.find((mode) =>
    mode.headers.length === activeHeaders.length &&
    mode.headers.every((expected) => {
      const active = activeHeaders.find(
        ({ header }) => header?.toLowerCase() === expected.header,
      );
      return active?.header?.toLowerCase() === expected.header && active?.value === expected.value;
    })) || MODES[0];
}

async function currentMode() {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  return modeForRule(rules.find((rule) => rule.id === RULE_ID));
}

async function showMode(mode, errorMessage) {
  await chrome.action.setBadgeText({ text: errorMessage ? "ERR" : mode.badge });
  await chrome.action.setBadgeBackgroundColor({ color: errorMessage ? "#b3261e" : "#315da8" });
  await chrome.action.setTitle({
    title: errorMessage
      ? `Functional A/B probe error: ${errorMessage}`
      : `Functional A/B probe mode: ${mode.id}. Click for next mode.`,
  });
}

async function activateMode(mode) {
  const update = { removeRuleIds: [RULE_ID] };
  if (mode.headers.length > 0) update.addRules = [ruleFor(mode)];

  await chrome.declarativeNetRequest.updateSessionRules(update);
  const accepted = await currentMode();
  if (accepted.id !== mode.id) {
    throw new Error(`Requested ${mode.id}, but active mode is ${accepted.id}.`);
  }
  await showMode(accepted);
  console.info("Functional A/B mode accepted", {
    mode: accepted.id,
    headers: accepted.headers.map(({ header }) => header),
  });
}

async function safelyActivateMode(mode) {
  try {
    await activateMode(mode);
    return { ok: true, mode: mode.id, ruleConfiguration: await ruleConfiguration(mode.id) };
  } catch (error) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [RULE_ID] }).catch(() => {});
    const message = error instanceof Error ? error.message : String(error);
    await showMode(MODES[0], message);
    console.error("Functional A/B mode rejected", { requestedMode: mode.id, error: message });
    return { ok: false, mode: mode.id, error: message };
  }
}

async function ruleConfiguration(mode) {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  const rule = rules.find(({ id }) => id === RULE_ID);
  return {
    mode,
    ruleId: rule?.id ?? null,
    resourceTypes: rule?.condition?.resourceTypes || [],
    requestHeaders: (rule?.action?.requestHeaders || []).map(({ header, operation, value }) => ({
      header,
      operation,
      value,
    })),
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_MODE") {
    currentMode()
      .then(async (mode) => ({
        ok: true,
        mode: mode.id,
        ruleConfiguration: await ruleConfiguration(mode.id),
      }))
      .then(sendResponse)
      .catch((error) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    return true;
  }

  if (message?.type === "ACTIVATE_MODE") {
    const mode = MODES.find(({ id }) => id === message.mode);
    if (!mode) {
      sendResponse({ ok: false, error: "Unknown mode." });
      return false;
    }
    safelyActivateMode(mode).then(sendResponse);
    return true;
  }

  if (message?.type === "LOG_RESULTS") {
    console.info("Functional A/B test results", message.results);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("runner.html") })
    .catch((error) => console.error("Could not open functional A/B runner", error));
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [RULE_ID] })
    .then(() => showMode(MODES[0]))
    .catch((error) => showMode(MODES[0], String(error)));
});

chrome.runtime.onStartup.addListener(() => {
  currentMode().then((mode) => showMode(mode)).catch((error) => showMode(MODES[0], String(error)));
});
