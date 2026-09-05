"use strict";

const input = document.querySelector("#host-input");
const normalizedHost = document.querySelector("#normalized-host");
const inputError = document.querySelector("#input-error");
const statusHost = document.querySelector("#status-host");
const httpsStatus = document.querySelector("#https-status");
const httpStatus = document.querySelector("#http-status");
const operationResult = document.querySelector("#operation-result");
const operationLog = document.querySelector("#operation-log");

function normalizeHost(value) {
  const raw = value.trim();
  if (!raw) throw new Error("Enter a hostname or HTTP(S) URL.");
  if (raw.includes("*")) throw new Error("Wildcard hosts are not accepted.");

  const explicitScheme = raw.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (explicitScheme && !/^https?$/i.test(explicitScheme[1])) {
    throw new Error("Only HTTP and HTTPS URLs are accepted.");
  }

  let parsed;
  try {
    if (raw.startsWith("//")) parsed = new URL(`https:${raw}`);
    else if (explicitScheme) parsed = new URL(raw);
    else parsed = new URL(`https://${raw}`);
  } catch {
    throw new Error("The hostname or URL is invalid.");
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are accepted.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URLs containing user information are not accepted.");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  if (!hostname || hostname.includes("*") || /[\s/]/.test(hostname)) {
    throw new Error("The normalized hostname is invalid.");
  }

  return {
    hostname,
    origins: [`https://${hostname}/*`, `http://${hostname}/*`],
  };
}

function readTarget() {
  const target = normalizeHost(input.value);
  normalizedHost.textContent = target.hostname;
  inputError.textContent = "";
  return target;
}

function showInputError(error) {
  normalizedHost.textContent = "—";
  inputError.textContent = error instanceof Error ? error.message : String(error);
  operationResult.textContent = "Input error.";
}

function appendLog(operation, hostname, outcome) {
  const item = document.createElement("li");
  item.textContent = `${operation} ${hostname} → ${outcome}`;
  operationLog.append(item);
  operationLog.scrollTop = operationLog.scrollHeight;
}

function containsOrigin(origin) {
  return chrome.permissions.contains({ origins: [origin] });
}

async function checkTarget(target, operation = "CONTAINS") {
  const [httpsGranted, httpGranted] = await Promise.all([
    containsOrigin(target.origins[0]),
    containsOrigin(target.origins[1]),
  ]);

  statusHost.textContent = target.hostname;
  httpsStatus.textContent = httpsGranted ? "Granted" : "Not granted";
  httpStatus.textContent = httpGranted ? "Granted" : "Not granted";
  const outcome = `HTTPS=${httpsGranted}, HTTP=${httpGranted}`;
  operationResult.textContent = `${operation}: ${outcome}`;
  appendLog(operation, target.hostname, outcome);
  return { httpsGranted, httpGranted };
}

input.addEventListener("input", () => {
  try {
    readTarget();
  } catch (error) {
    showInputError(error);
  }
});

document.querySelector("#request").addEventListener("click", () => {
  let target;
  try {
    target = readTarget();
  } catch (error) {
    showInputError(error);
    return;
  }

  // Keep permissions.request directly in this click handler. Do not await or
  // schedule asynchronous work before this call; Quetta must retain the gesture.
  chrome.permissions.request({ origins: target.origins }, (granted) => {
    const runtimeError = chrome.runtime.lastError;
    if (runtimeError) {
      operationResult.textContent = `REQUEST error: ${runtimeError.message}`;
      appendLog("REQUEST", target.hostname, "error");
      return;
    }

    appendLog("REQUEST", target.hostname, granted ? "granted" : "denied");
    checkTarget(target, "POST-REQUEST CONTAINS").catch((error) => {
      operationResult.textContent = `CHECK error: ${error.message}`;
    });
  });
});

document.querySelector("#check").addEventListener("click", () => {
  let target;
  try {
    target = readTarget();
  } catch (error) {
    showInputError(error);
    return;
  }

  checkTarget(target).catch((error) => {
    operationResult.textContent = `CHECK error: ${error.message}`;
    appendLog("CONTAINS", target.hostname, "error");
  });
});

document.querySelector("#remove").addEventListener("click", () => {
  let target;
  try {
    target = readTarget();
  } catch (error) {
    showInputError(error);
    return;
  }

  chrome.permissions.remove({ origins: target.origins }, (removed) => {
    const runtimeError = chrome.runtime.lastError;
    if (runtimeError) {
      operationResult.textContent = `REMOVE error: ${runtimeError.message}`;
      appendLog("REMOVE", target.hostname, "error");
      return;
    }

    appendLog("REMOVE", target.hostname, removed ? "removed" : "not removed");
    checkTarget(target, "POST-REMOVE CONTAINS").catch((error) => {
      operationResult.textContent = `CHECK error: ${error.message}`;
    });
  });
});
