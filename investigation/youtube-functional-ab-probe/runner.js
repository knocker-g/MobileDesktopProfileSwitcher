"use strict";

const HOME_URL = "https://www.youtube.com/";
const LOAD_TIMEOUT_MS = 60_000;
const DOM_SETTLE_MS = 8_000;
const STEPS = Object.freeze([
  { key: "OFF", mode: "OFF" },
  { key: "A", mode: "A" },
  { key: "B", mode: "B" },
  { key: "C", mode: "C" },
  { key: "D", mode: "D" },
  { key: "offRecovery", mode: "OFF" },
]);

const runButton = document.querySelector("#run-all");
const copyButton = document.querySelector("#copy-result");
const liveUrlInput = document.querySelector("#live-url");
const statusNode = document.querySelector("#status");
const progressNode = document.querySelector("#progress");
const resultNode = document.querySelector("#result");
const currentModeNode = document.querySelector("#current-mode");
const manualModeButtons = Array.from(document.querySelectorAll("[data-mode]"));

let latestResult = null;
let running = false;
let manualChanging = false;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function targetFromInput() {
  const raw = liveUrlInput.value.trim();
  if (!raw) return { url: HOME_URL, hasLiveTarget: false };

  const parsed = new URL(raw);
  const allowedHosts = new Set(["www.youtube.com", "m.youtube.com", "youtu.be"]);
  if (parsed.protocol !== "https:" || !allowedHosts.has(parsed.hostname)) {
    throw new Error("Live URL must use HTTPS on www.youtube.com, m.youtube.com, or youtu.be.");
  }

  if (parsed.hostname === "m.youtube.com") parsed.hostname = "www.youtube.com";
  if (parsed.hostname === "youtu.be") {
    const videoId = parsed.pathname.split("/").filter(Boolean)[0];
    if (!videoId) throw new Error("The youtu.be URL does not contain a video ID.");
    parsed.hostname = "www.youtube.com";
    parsed.pathname = "/watch";
    parsed.search = "";
    parsed.searchParams.set("v", videoId);
    parsed.hash = "";
  }

  return { url: parsed.href, hasLiveTarget: true };
}

function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    let timer;
    const finish = (error) => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      error ? reject(error) : resolve();
    };
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") finish();
    };
    chrome.tabs.onUpdated.addListener(listener);
    timer = setTimeout(() => finish(new Error("Navigation load timeout.")), LOAD_TIMEOUT_MS);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") finish();
    }).catch((error) => finish(error));
  });
}

function showCurrentMode(mode) {
  currentModeNode.textContent = `Current mode: ${mode}`;
  manualModeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  });
}

function setManualControlsDisabled(disabled) {
  manualModeButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

async function activateMode(mode) {
  const response = await chrome.runtime.sendMessage({ type: "ACTIVATE_MODE", mode });
  if (!response?.ok) {
    showCurrentMode("ERR");
    throw new Error(response?.error || `Could not activate ${mode}.`);
  }
  showCurrentMode(response.mode);
  return response.ruleConfiguration;
}

async function selectManualMode(mode) {
  if (running || manualChanging) return;
  manualChanging = true;
  runButton.disabled = true;
  setManualControlsDisabled(true);
  statusNode.textContent = `Manual Mode: applying ${mode}…`;
  try {
    await activateMode(mode);
    statusNode.textContent = mode === "OFF"
      ? "Manual Mode is OFF. Native headers will apply to the next navigation."
      : `Manual Mode ${mode} is active. Open a fresh Quetta tab manually.`;
  } catch (error) {
    showCurrentMode("ERR");
    statusNode.textContent = `Manual Mode failed and rules were cleared: ${
      error instanceof Error ? error.message : String(error)
    }`;
  } finally {
    manualChanging = false;
    runButton.disabled = false;
    setManualControlsDisabled(false);
  }
}

async function collectFromFreshTab(target, mode) {
  let createdTabId = null;
  try {
    const tab = await chrome.tabs.create({ url: target.url, active: true });
    createdTabId = tab.id;
    await waitForTabComplete(createdTabId);
    await delay(DOM_SETTLE_MS);
    const response = await chrome.tabs.sendMessage(createdTabId, {
      type: "COLLECT_DIAGNOSTICS",
      hasLiveTarget: target.hasLiveTarget,
    });
    if (!response?.ok) throw new Error(`Page diagnostics failed for ${mode}.`);
    return response.diagnostics;
  } finally {
    if (createdTabId !== null) await chrome.tabs.remove(createdTabId).catch(() => {});
  }
}

function blankStep(mode, error) {
  return {
    mode,
    ruleConfiguration: null,
    wireVerification: "NOT_CAPTURED",
    viewport: null,
    desktopWeb: "UNKNOWN",
    login: "UNKNOWN",
    liveChat: "UNKNOWN",
    oldBrowserWarning: "UNKNOWN",
    basicOperation: "UNKNOWN",
    automationError: error,
  };
}

async function runStep(step, target) {
  statusNode.textContent = `${step.key}: applying ${step.mode} rule configuration…`;
  let ruleConfiguration;
  try {
    ruleConfiguration = await activateMode(step.mode);
    statusNode.textContent = `${step.key}: loading a fresh YouTube tab…`;
    const diagnostics = await collectFromFreshTab(target, step.mode);
    return {
      mode: step.mode,
      ruleConfiguration,
      wireVerification: "NOT_CAPTURED",
      ...diagnostics,
      automationError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...blankStep(step.mode, message), ruleConfiguration };
  }
}

async function ensureOff() {
  await activateMode("OFF");
}

async function runAll() {
  if (running || manualChanging) return;
  const target = targetFromInput();
  running = true;
  runButton.disabled = true;
  copyButton.disabled = true;
  liveUrlInput.disabled = true;
  setManualControlsDisabled(true);
  progressNode.value = 0;

  const report = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    environment: {
      target: "YouTube",
      targetPage: target.hasLiveTarget ? "user-supplied-live-page" : "homepage",
      fixture: "Chrome 154 experiment fixture",
      scope: "https://www.youtube.com/* main_frame only",
      actualWireHeadersCaptured: false,
    },
    results: {},
    offRecovery: null,
  };

  try {
    for (const step of STEPS) {
      const stepResult = await runStep(step, target);
      if (step.key === "offRecovery") report.offRecovery = stepResult;
      else report.results[step.key] = stepResult;
      progressNode.value += 1;
      resultNode.textContent = JSON.stringify(report, null, 2);
    }
    latestResult = report;
    await chrome.runtime.sendMessage({ type: "LOG_RESULTS", results: report });
    statusNode.textContent = "Run complete. Actual wire verification remains a separate manual/CDP step.";
    copyButton.disabled = false;
  } finally {
    await ensureOff().catch((error) => {
      statusNode.textContent = `Run ended, but OFF restoration failed: ${error.message}`;
    });
    running = false;
    runButton.disabled = false;
    liveUrlInput.disabled = false;
    setManualControlsDisabled(false);
  }
}

runButton.addEventListener("click", () => {
  runAll().catch((error) => {
    statusNode.textContent = error instanceof Error ? error.message : String(error);
  });
});

copyButton.addEventListener("click", async () => {
  if (!latestResult) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(latestResult, null, 2));
    statusNode.textContent = "Result JSON copied.";
  } catch (error) {
    statusNode.textContent = `Copy failed: ${error instanceof Error ? error.message : String(error)}`;
  }
});

manualModeButtons.forEach((button) => {
  button.addEventListener("click", () => selectManualMode(button.dataset.mode));
});

chrome.runtime.sendMessage({ type: "GET_MODE" })
  .then((response) => {
    if (!response?.ok) throw new Error(response?.error || "Could not read current mode.");
    showCurrentMode(response.mode);
  })
  .catch((error) => {
    showCurrentMode("ERR");
    statusNode.textContent = error instanceof Error ? error.message : String(error);
  });
