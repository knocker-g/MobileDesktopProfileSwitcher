const requestButton = document.getElementById("request");
const checkButton = document.getElementById("check");
const removeButton = document.getElementById("remove");
const summary = document.getElementById("summary");
const permission = document.getElementById("permission");
const continuation = document.getElementById("continuation");
const badge = document.getElementById("badge");
const events = document.getElementById("events");

function render(result) {
  summary.textContent = result.summary;
  permission.textContent = result.granted ? "Granted" : "Not granted";
  continuation.textContent = result.continuationReached ? "Reached" : "Not confirmed";
  badge.textContent = result.badgeText || "Empty";
  events.replaceChildren(...result.events.map((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    return item;
  }));
}

async function check() {
  try {
    render(await chrome.runtime.sendMessage({ type: "CHECK_STATUS" }));
  } catch (error) {
    summary.textContent = `Could not query the service worker: ${error.message}`;
  }
}

requestButton.addEventListener("click", () => {
  requestButton.disabled = true;
  summary.textContent = "Message sent. Complete the browser permission UI, then reopen this popup.";
  // Intentionally no await or other asynchronous work before this message.
  chrome.runtime.sendMessage({ type: "REQUEST_PERMISSION_FROM_SW" }).then(render).catch((error) => {
    summary.textContent = `Request failed: ${error.message}`;
  }).finally(() => { requestButton.disabled = false; });
});

checkButton.addEventListener("click", check);
removeButton.addEventListener("click", async () => {
  removeButton.disabled = true;
  try { render(await chrome.runtime.sendMessage({ type: "REMOVE_PERMISSION" })); }
  catch (error) { summary.textContent = `Remove failed: ${error.message}`; }
  finally { removeButton.disabled = false; }
});

check();
