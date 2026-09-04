"use strict";

const STATUS = Object.freeze({
  UNKNOWN: "UNKNOWN",
  NOT_TESTED: "NOT_TESTED",
  MANUAL: "MANUAL_CHECK_REQUIRED",
});

function exists(selector) {
  return Boolean(document.querySelector(selector));
}

function classifyDesktopWeb() {
  const evidence = {
    desktopApp: exists("ytd-app"),
    desktopPage: exists("ytd-watch-flexy, ytd-browse"),
    desktopMasthead: exists("ytd-masthead"),
    mobileApp: exists("ytm-app"),
    mobileTopbar: exists("ytm-mobile-topbar-renderer"),
  };
  const desktopCount = [evidence.desktopApp, evidence.desktopPage, evidence.desktopMasthead]
    .filter(Boolean).length;
  const mobileCount = [evidence.mobileApp, evidence.mobileTopbar].filter(Boolean).length;

  let value = STATUS.UNKNOWN;
  if (desktopCount >= 2 && mobileCount === 0) value = true;
  if (mobileCount >= 1 && desktopCount === 0) value = false;
  return { value, evidence };
}

function classifyLogin() {
  const evidence = {
    accountButton: exists("#avatar-btn, ytd-topbar-menu-button-renderer #avatar-btn"),
    accountAvatar: exists("#avatar-btn img, yt-img-shadow#avatar"),
    signInControl: exists(
      'a[href^="https://accounts.google.com/ServiceLogin"], ytd-button-renderer a[href*="accounts.google.com"]',
    ),
  };
  const accountSignal = evidence.accountButton || evidence.accountAvatar;

  let value = STATUS.UNKNOWN;
  if (accountSignal && !evidence.signInControl) value = true;
  if (!accountSignal && evidence.signInControl) value = false;
  return { value, evidence };
}

function hasOldBrowserWarning() {
  const warningPattern = /(?:チャットをご利用いただけません|ブラウザバージョンが古い|chat (?:is )?unavailable|browser (?:is |seems )?(?:out of date|too old))/i;
  const documents = [document];
  const frame = document.querySelector("ytd-live-chat-frame iframe, iframe#chatframe");
  try {
    if (frame?.contentDocument) documents.push(frame.contentDocument);
  } catch {
    // Cross-origin/inaccessible frames remain a structural signal only.
  }
  return documents.some((candidateDocument) => {
    const candidates = candidateDocument.querySelectorAll(
      "yt-live-chat-renderer, #chat, #contents, #error-message, .yt-alert-message-renderer",
    );
    return Array.from(candidates).some((node) => warningPattern.test(node.textContent || ""));
  });
}

function classifyLiveChat(hasLiveTarget) {
  if (!hasLiveTarget) {
    return { value: STATUS.NOT_TESTED, oldBrowserWarning: STATUS.NOT_TESTED, evidence: {} };
  }

  const evidence = {
    chatComponent: exists("ytd-live-chat-frame, yt-live-chat-renderer"),
    chatFrame: exists("ytd-live-chat-frame iframe, iframe#chatframe"),
    chatFrameLoaded: (() => {
      const frame = document.querySelector("ytd-live-chat-frame iframe, iframe#chatframe");
      try {
        return frame?.contentDocument?.readyState === "complete";
      } catch {
        return false;
      }
    })(),
  };
  const oldBrowserWarning = hasOldBrowserWarning();

  if (oldBrowserWarning) return { value: false, oldBrowserWarning: true, evidence };
  if (evidence.chatComponent && evidence.chatFrame) {
    return { value: STATUS.MANUAL, oldBrowserWarning: false, evidence };
  }
  return { value: STATUS.UNKNOWN, oldBrowserWarning: false, evidence };
}

function isActuallyVisible(element) {
  if (typeof element.checkVisibility === "function") {
    try {
      return element.checkVisibility({
        opacityProperty: true,
        visibilityProperty: true,
        checkOpacity: true,
        checkVisibilityCSS: true,
      });
    } catch {
      // Fall through for implementations with a different options shape.
    }
  }

  const style = window.getComputedStyle(element);
  if (
    element.hidden ||
    element.getAttribute("aria-hidden") === "true" ||
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.visibility === "collapse" ||
    Number(style.opacity) === 0
  ) {
    return false;
  }
  return Array.from(element.getClientRects()).some(({ width, height }) => width > 0 && height > 0);
}

function playabilityErrorDiagnostics() {
  const candidates = Array.from(document.querySelectorAll(
    "yt-playability-error-supported-renderers, ytd-player-error-message-renderer, #error-screen, .ytp-error",
  ));
  const visibleCandidates = candidates.filter(isActuallyVisible);
  const player = document.querySelector("#movie_player, .html5-video-player");
  const activePlayerErrorState = Boolean(
    player?.classList.contains("ytp-error") || player?.getAttribute("data-error")?.trim(),
  );
  const errorTextPattern = /(?:再生できません|エラー|問題が発生|video unavailable|playback error|an error occurred|try again)/i;
  const visibleErrorTextSignal = visibleCandidates.some((element) =>
    errorTextPattern.test(element.textContent || ""));

  let value = false;
  if (activePlayerErrorState || (visibleCandidates.length > 0 && visibleErrorTextSignal)) {
    value = true;
  } else if (visibleCandidates.length > 0) {
    value = STATUS.UNKNOWN;
  }

  return {
    value,
    evidence: {
      errorComponentPresent: candidates.length > 0,
      visibleErrorComponent: visibleCandidates.length > 0,
      activePlayerErrorState,
      visibleErrorTextSignal,
    },
  };
}

function classifyBasicOperation(hasLiveTarget) {
  const playabilityError = playabilityErrorDiagnostics();
  const evidence = {
    videoElement: exists("video"),
    playabilityError: playabilityError.value,
    playabilityErrorEvidence: playabilityError.evidence,
  };

  if (playabilityError.value === true) return { value: false, evidence };
  if (playabilityError.value === STATUS.UNKNOWN) return { value: STATUS.MANUAL, evidence };
  if (evidence.videoElement) return { value: STATUS.MANUAL, evidence };
  return { value: hasLiveTarget ? STATUS.UNKNOWN : STATUS.NOT_TESTED, evidence };
}

function viewportDiagnostics() {
  const values = {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  };
  const finite = Object.values(values).every(Number.isFinite);
  return {
    ...values,
    nativeNarrowViewportHeuristic: finite
      ? values.innerWidth < values.innerHeight && values.screenWidth < values.screenHeight
      : STATUS.UNKNOWN,
    heuristicScope: "Xperia 1 V portrait experiment only; not a product threshold",
  };
}

function collectDiagnostics(hasLiveTarget) {
  const liveChat = classifyLiveChat(hasLiveTarget);
  return {
    viewport: viewportDiagnostics(),
    desktopWeb: classifyDesktopWeb(),
    login: classifyLogin(),
    liveChat: { value: liveChat.value, evidence: liveChat.evidence },
    oldBrowserWarning: liveChat.oldBrowserWarning,
    basicOperation: classifyBasicOperation(hasLiveTarget),
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "COLLECT_DIAGNOSTICS") return false;
  sendResponse({ ok: true, diagnostics: collectDiagnostics(Boolean(message.hasLiveTarget)) });
  return false;
});
