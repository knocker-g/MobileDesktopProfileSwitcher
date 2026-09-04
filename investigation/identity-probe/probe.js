"use strict";

const HIGH_ENTROPY_HINTS = [
  "architecture",
  "bitness",
  "model",
  "platformVersion",
  "uaFullVersion",
  "fullVersionList",
];

const output = document.querySelector("#output");
const status = document.querySelector("#status");
let latestJson = "";

function errorDetails(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || String(error),
  };
}

function observeProperty(object, property) {
  try {
    if (!(property in object)) return { status: "unsupported" };
    const value = object[property];
    if (value === undefined || value === null) return { status: "unavailable", value: value ?? null };
    return { status: "available", value: Array.isArray(value) ? Array.from(value) : value };
  } catch (error) {
    return { status: "error", error: errorDetails(error) };
  }
}

async function observeUserAgentData(nav) {
  let uaData;
  try {
    if (!("userAgentData" in nav)) return { status: "unsupported" };
    uaData = nav.userAgentData;
    if (!uaData) return { status: "unavailable" };
  } catch (error) {
    return { status: "error", error: errorDetails(error) };
  }

  const result = {
    status: "available",
    lowEntropy: {
      brands: observeProperty(uaData, "brands"),
      mobile: observeProperty(uaData, "mobile"),
      platform: observeProperty(uaData, "platform"),
    },
  };

  if (typeof uaData.getHighEntropyValues !== "function") {
    result.highEntropy = { status: "unsupported" };
    return result;
  }

  try {
    const values = await uaData.getHighEntropyValues(HIGH_ENTROPY_HINTS);
    result.highEntropy = { status: "available", values: {} };
    for (const hint of HIGH_ENTROPY_HINTS) {
      result.highEntropy.values[hint] = Object.prototype.hasOwnProperty.call(values, hint)
        ? { status: "available", value: values[hint] }
        : { status: "unavailable" };
    }
  } catch (error) {
    result.highEntropy = { status: "error", error: errorDetails(error) };
  }
  return result;
}

async function observePage() {
  const fields = ["userAgent", "platform", "vendor", "product", "appVersion", "language", "languages"];
  const navigatorValues = {};
  for (const field of fields) navigatorValues[field] = observeProperty(navigator, field);
  return {
    navigator: navigatorValues,
    userAgentData: await observeUserAgentData(navigator),
  };
}

function observeWorker() {
  return new Promise((resolve) => {
    if (!("Worker" in window)) {
      resolve({ status: "unsupported" });
      return;
    }

    let worker;
    const timeout = window.setTimeout(() => {
      worker?.terminate();
      resolve({ status: "error", error: { name: "TimeoutError", message: "Worker probe timed out after 10 seconds." } });
    }, 10000);

    try {
      worker = new Worker("worker.js");
      worker.onmessage = (event) => {
        window.clearTimeout(timeout);
        worker.terminate();
        resolve(event.data);
      };
      worker.onerror = (event) => {
        window.clearTimeout(timeout);
        worker.terminate();
        resolve({ status: "error", error: { name: "WorkerError", message: event.message || "Worker failed." } });
      };
      worker.postMessage({ command: "run" });
    } catch (error) {
      window.clearTimeout(timeout);
      resolve({ status: "error", error: errorDetails(error) });
    }
  });
}

async function runProbe() {
  status.textContent = "Running probe…";
  const result = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    context: {
      secureContext: window.isSecureContext,
      visibilityState: document.visibilityState,
    },
    page: await observePage(),
    worker: await observeWorker(),
  };
  latestJson = JSON.stringify(result, null, 2);
  output.textContent = latestJson;
  status.textContent = "Probe complete. Results remain in this page unless you copy or download them.";
}

async function copyJson() {
  if (!latestJson) {
    status.textContent = "Run the probe before copying.";
    return;
  }
  try {
    await navigator.clipboard.writeText(latestJson);
    status.textContent = "JSON copied.";
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = latestJson;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    status.textContent = copied ? "JSON copied." : "Copy was unavailable; select the JSON output manually.";
  }
}

function downloadJson() {
  if (!latestJson) {
    status.textContent = "Run the probe before downloading.";
    return;
  }
  const blob = new Blob([latestJson], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `identity-probe-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  status.textContent = "JSON download requested.";
}

document.querySelector("#run").addEventListener("click", () => runProbe().catch((error) => {
  const failure = { status: "error", error: errorDetails(error) };
  latestJson = JSON.stringify(failure, null, 2);
  output.textContent = latestJson;
  status.textContent = "Probe completed with an unexpected error recorded in JSON.";
}));
document.querySelector("#copy").addEventListener("click", copyJson);
document.querySelector("#download").addEventListener("click", downloadJson);
