"use strict";

const HIGH_ENTROPY_HINTS = [
  "architecture",
  "bitness",
  "model",
  "platformVersion",
  "uaFullVersion",
  "fullVersionList",
];

function errorDetails(error) {
  return { name: error?.name || "Error", message: error?.message || String(error) };
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

async function observeUserAgentData() {
  let uaData;
  try {
    if (!("userAgentData" in navigator)) return { status: "unsupported" };
    uaData = navigator.userAgentData;
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

self.onmessage = async (event) => {
  if (event.data?.command !== "run") return;
  try {
    self.postMessage({
      status: "available",
      navigator: {
        userAgent: observeProperty(navigator, "userAgent"),
        platform: observeProperty(navigator, "platform"),
      },
      userAgentData: await observeUserAgentData(),
    });
  } catch (error) {
    self.postMessage({ status: "error", error: errorDetails(error) });
  }
};
