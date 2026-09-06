import { createActiveTabAdapter } from "../adapters/active-tab.js";
import { createChromePermissionsAdapter } from "../adapters/chrome-permissions.js";
import { PROFILE } from "../core/profiles.js";
import { MESSAGE_TYPE } from "../runtime/runtime.js";
import {
  VIEW,
  addHostRow,
  createPopupModel,
  createSiteForm,
  removeHostRow,
  validateSiteForm,
} from "./popup-model.js";
import { requestExactHostAccess } from "./popup-actions.js";

const activeTab = createActiveTabAdapter(chrome.tabs);
const permissions = createChromePermissionsAdapter(chrome.permissions);
const popupElementIds = Object.freeze({
  app: "app",
  globalToggle: "global-toggle",
  status: "status",
  error: "error",
  currentView: "current-view",
  currentContent: "current-content",
  otherSites: "other-sites",
  otherSitesSummary: "other-sites-summary",
  siteList: "site-list",
  formView: "form-view",
  formTitle: "form-title",
  siteForm: "site-form",
  siteName: "site-name",
  hostList: "host-list",
  addHost: "add-host",
  formProfiles: "form-profiles",
  removeArea: "remove-area",
  startRemove: "start-remove",
  removeConfirm: "remove-confirm",
  cancelRemove: "cancel-remove",
  confirmRemove: "confirm-remove",
  cancelForm: "cancel-form",
  saveSite: "save-site",
});

const elements = Object.freeze(Object.fromEntries(
  Object.entries(popupElementIds).map(([property, id]) => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing popup element: ${id}`);
    return [property, element];
  }),
));

if (elements.saveSite.form !== elements.siteForm) {
  throw new Error("Popup save button is not associated with the site form.");
}

let state = null;
let model = null;
let view = VIEW.CURRENT;
let form = null;
let busy = false;

async function command(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, payload });
  if (!response?.ok) {
    const error = new Error(response?.error?.message || "Runtime request failed.");
    error.code = response?.error?.code;
    throw error;
  }
  return response.value;
}

async function refreshIfStale(error) {
  if (error?.code === "stale_revision") await refresh();
}

function showError(message = "") {
  elements.error.textContent = message;
  elements.error.hidden = !message;
}

function setBusy(value, label = "Working…") {
  busy = value;
  elements.app.setAttribute("aria-busy", String(value));
  for (const button of elements.app.querySelectorAll("button")) button.disabled = value;
  elements.status.textContent = value ? label : "";
}

function profileButtons(container, selected, disabled, onSelect) {
  container.replaceChildren();
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", "Profile");
  for (const profile of [PROFILE.DEFAULT, PROFILE.DESKTOP, PROFILE.MOBILE]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = profile[0].toUpperCase() + profile.slice(1);
    button.dataset.profile = profile;
    button.setAttribute("aria-pressed", String(profile === selected));
    button.disabled = disabled;
    button.addEventListener("click", () => onSelect(profile));
    container.append(button);
  }
}

function paragraph(text, className = "") {
  const node = document.createElement("p");
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

async function refresh() {
  const [nextState, activeUrl] = await Promise.all([
    command(MESSAGE_TYPE.GET_STATE),
    activeTab.getCurrentUrl(),
  ]);
  const inspections = await command(MESSAGE_TYPE.INSPECT_PERMISSIONS);
  state = nextState;
  model = createPopupModel(state, activeUrl, inspections);
  render();
}

function openForm(nextForm) {
  form = nextForm;
  view = form.siteId ? VIEW.EDIT : VIEW.ADD;
  showError();
  render();
}

async function quickProfile(profile) {
  if (busy || !model.currentSite || !state.enabled) return;
  setBusy(true, "Applying profile…");
  showError();
  try {
    await command(MESSAGE_TYPE.SET_PROFILE, { expectedRevision: state.revision, siteId: model.currentSite.id, profile });
    await refresh();
  } catch (error) {
    await refreshIfStale(error);
    showError("Could not save changes.");
  } finally { setBusy(false); render(); }
}

function renderCurrent() {
  elements.currentContent.replaceChildren();
  if (!model.hostname) {
    elements.currentContent.append(paragraph("This page cannot be added."));
    const manual = document.createElement("button");
    manual.type = "button";
    manual.className = "secondary link-button";
    manual.textContent = "Add site manually";
    manual.addEventListener("click", () => openForm(createSiteForm()));
    elements.currentContent.append(manual);
  } else if (!model.currentSite) {
    elements.currentContent.append(paragraph(model.hostname, "hostname"));
    const add = document.createElement("button");
    add.type = "button";
    add.className = "link-button";
    add.textContent = "Add this site";
    add.addEventListener("click", () => openForm(createSiteForm({ hostname: model.hostname })));
    elements.currentContent.append(add);
  } else {
    elements.currentContent.append(
      paragraph(model.currentSite.name, "site-name"),
      paragraph(model.hostname, "hostname"),
    );
    const profiles = document.createElement("div");
    profiles.className = "profile-control";
    profileButtons(profiles, model.currentSite.profile, !state.enabled || busy, quickProfile);
    elements.currentContent.append(profiles);
    if (!state.enabled) elements.currentContent.append(paragraph(`${labelProfile(model.currentSite.profile)} selected — Global OFF`));
    if (!model.currentPermissionReady) {
      elements.currentContent.append(paragraph("Site access required.", "error"));
      const grant = document.createElement("button");
      grant.type = "button";
      grant.textContent = "Grant access";
      grant.addEventListener("click", grantCurrentSite);
      elements.currentContent.append(grant);
    }
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "secondary link-button";
    edit.textContent = "Edit site";
    edit.addEventListener("click", () => openForm(createSiteForm({ site: model.currentSite })));
    elements.currentContent.append(edit);
  }

  elements.siteList.replaceChildren();
  elements.otherSites.hidden = model.otherSites.length === 0;
  elements.otherSitesSummary.textContent = `Other sites (${model.otherSites.length})`;
  for (const site of model.otherSites) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.append(document.createTextNode(site.name), document.createTextNode(labelProfile(site.profile)));
    button.addEventListener("click", () => openForm(createSiteForm({ site })));
    item.append(button);
    elements.siteList.append(item);
  }
}

function labelProfile(profile) {
  return profile[0].toUpperCase() + profile.slice(1);
}

function syncFormFromDom() {
  form = Object.freeze({
    ...form,
    name: elements.siteName.value,
    hosts: Object.freeze([...elements.hostList.querySelectorAll("input")].map((input) => input.value)),
  });
  return form;
}

function renderForm() {
  elements.formTitle.textContent = view === VIEW.EDIT ? "Edit site" : "Add site";
  elements.siteName.value = form.name;
  elements.hostList.replaceChildren();
  form.hosts.forEach((hostname, index) => {
    const row = document.createElement("div");
    row.className = "host-row";
    const label = document.createElement("label");
    label.className = "visually-hidden";
    label.textContent = `Host ${index + 1}`;
    const input = document.createElement("input");
    input.id = `host-${index}`;
    label.htmlFor = input.id;
    input.value = hostname;
    input.placeholder = "www.example.com";
    input.setAttribute("aria-label", `Host ${index + 1}`);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary";
    remove.textContent = "Remove";
    remove.disabled = form.hosts.length <= 1;
    remove.addEventListener("click", () => {
      syncFormFromDom();
      form = removeHostRow(form, index);
      renderForm();
    });
    row.append(label, input, remove);
    elements.hostList.append(row);
  });
  profileButtons(elements.formProfiles, form.profile, busy, (profile) => {
    syncFormFromDom();
    form = Object.freeze({ ...form, profile });
    renderForm();
  });
  elements.removeArea.hidden = view !== VIEW.EDIT;
  elements.removeConfirm.hidden = true;
  elements.startRemove.hidden = false;
}

function render() {
  if (!state || !model) return;
  elements.globalToggle.textContent = state.enabled ? "ON" : "OFF";
  elements.globalToggle.setAttribute("aria-pressed", String(state.enabled));
  elements.globalToggle.disabled = busy;
  elements.currentView.hidden = view !== VIEW.CURRENT;
  elements.formView.hidden = view === VIEW.CURRENT;
  if (view === VIEW.CURRENT) renderCurrent(); else renderForm();
  elements.app.setAttribute("aria-busy", String(busy));
}

function duplicateAcrossSites(hosts) {
  const editingId = form.siteId;
  const registered = new Set(state.sites.filter((site) => site.id !== editingId).flatMap((site) => site.hosts.map((host) => host.hostname)));
  return hosts.some((host) => registered.has(host));
}

async function saveForm(event) {
  event.preventDefault();
  if (busy) return;
  const candidate = validateSiteForm(syncFormFromDom());
  if (!candidate.valid) return showError(candidate.error);
  if (duplicateAcrossSites(candidate.value.hosts)) return showError("This host is already registered.");
  const oldHosts = new Set(model.currentSite?.id === form.siteId ? model.currentSite.hosts.map((host) => host.hostname) : state.sites.find((site) => site.id === form.siteId)?.hosts.map((host) => host.hostname) ?? []);
  const requiredHosts = form.siteId ? candidate.value.hosts.filter((host) => !oldHosts.has(host)) : candidate.value.hosts;

  setBusy(true, "Requesting site access…");
  showError();
  const permissionPromise = requestExactHostAccess(requiredHosts, permissions);
  try {
    if (!(await permissionPromise)) {
      showError("Site access was not granted.");
      return;
    }
    const type = form.siteId ? MESSAGE_TYPE.UPDATE_SITE : MESSAGE_TYPE.CREATE_SITE;
    const site = form.siteId ? { siteId: form.siteId, ...candidate.value } : candidate.value;
    const result = await command(type, { expectedRevision: state.revision, site });
    if (result?.permissionCleanup?.released === false || result?.permissionCleanup?.warning) {
      showError("Changes were saved, but unused site access could not be removed.");
    }
    view = VIEW.CURRENT;
    await refresh();
  } catch (error) {
    await refreshIfStale(error);
    showError("Could not save changes.");
  } finally { setBusy(false); render(); }
}

async function grantCurrentSite() {
  if (busy || !model.currentSite) return;
  setBusy(true, "Requesting site access…");
  showError();
  const hosts = model.currentSite.hosts.map((host) => host.hostname);
  const permissionPromise = requestExactHostAccess(hosts, permissions);
  try {
    if (!(await permissionPromise)) return showError("Site access was not granted.");
    await command(MESSAGE_TYPE.RECONCILE);
    await refresh();
  } catch { showError("Could not grant site access."); }
  finally { setBusy(false); render(); }
}

elements.globalToggle.addEventListener("click", async () => {
  if (busy || !state) return;
  setBusy(true, state.enabled ? "Turning off…" : "Turning on…");
  showError();
  try {
    await command(MESSAGE_TYPE.SET_ENABLED, { expectedRevision: state.revision, enabled: !state.enabled });
    await refresh();
  } catch (error) { await refreshIfStale(error); showError("Could not save changes."); }
  finally { setBusy(false); render(); }
});
elements.siteForm.addEventListener("submit", saveForm);
elements.addHost.addEventListener("click", () => { syncFormFromDom(); form = addHostRow(form); renderForm(); });
elements.cancelForm.addEventListener("click", () => { view = VIEW.CURRENT; showError(); render(); });
elements.startRemove.addEventListener("click", () => { elements.startRemove.hidden = true; elements.removeConfirm.hidden = false; });
elements.cancelRemove.addEventListener("click", () => { elements.startRemove.hidden = false; elements.removeConfirm.hidden = true; });
elements.confirmRemove.addEventListener("click", async () => {
  if (busy || !form.siteId) return;
  setBusy(true, "Removing site…");
  try {
    await command(MESSAGE_TYPE.DELETE_SITE, { expectedRevision: state.revision, siteId: form.siteId });
    view = VIEW.CURRENT;
    await refresh();
  } catch (error) { await refreshIfStale(error); showError("Could not remove site."); }
  finally { setBusy(false); render(); }
});

refresh().then(() => {
  elements.status.textContent = "";
  elements.app.setAttribute("aria-busy", "false");
}).catch(() => {
  elements.status.textContent = "";
  showError("Could not load MDPS.");
});
