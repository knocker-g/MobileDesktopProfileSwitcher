import { createActiveTabAdapter } from "../adapters/active-tab.js";
import { createChromePermissionsAdapter } from "../adapters/chrome-permissions.js";
import { createChromeActionBadgeAdapter } from "../adapters/chrome-action-badge.js";
import { PROFILE } from "../core/profiles.js";
import { badgeTextForTab } from "./badge-model.js";
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
const actionBadge = createChromeActionBadgeAdapter(chrome.action);
const popupElementIds = Object.freeze({
  app: "app",
  globalToggle: "global-toggle",
  globalState: "global-state",
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
  formProfile: "form-profile",
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
let pendingDeleteSiteId = null;

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
  for (const control of elements.app.querySelectorAll("button, input, select")) control.disabled = value;
  elements.status.textContent = value ? label : "";
}

function profileSelect(selected, disabled, onSelect, id) {
  const field = document.createElement("div");
  field.className = "profile-field";
  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = "Profile";
  const select = document.createElement("select");
  select.id = id;
  for (const profile of [PROFILE.DEFAULT, PROFILE.DESKTOP, PROFILE.MOBILE]) {
    const option = document.createElement("option");
    option.value = profile;
    option.textContent = labelProfile(profile);
    select.append(option);
  }
  select.value = selected;
  select.disabled = disabled;
  select.addEventListener("change", () => onSelect(select.value));
  field.append(label, select);
  return field;
}

function paragraph(text, className = "") {
  const node = document.createElement("p");
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

async function refresh() {
  const [nextState, currentTab] = await Promise.all([
    command(MESSAGE_TYPE.GET_STATE),
    activeTab.getCurrentTab(),
  ]);
  const inspections = await command(MESSAGE_TYPE.INSPECT_PERMISSIONS);
  state = nextState;
  model = createPopupModel(state, currentTab.url, inspections);
  if (currentTab.id !== null) {
    await actionBadge.set(currentTab.id, badgeTextForTab(state, currentTab.url, inspections)).catch(() => undefined);
  }
  render();
}

function openForm(nextForm) {
  form = nextForm;
  view = form.siteId ? VIEW.EDIT : VIEW.ADD;
  showError();
  render();
}

async function quickProfile(siteId, profile) {
  if (busy || !state.enabled) return;
  setBusy(true, "Applying profile…");
  showError();
  try {
    await command(MESSAGE_TYPE.SET_PROFILE, { expectedRevision: state.revision, siteId, profile });
    await refresh();
  } catch (error) {
    await refreshIfStale(error);
    showError("Could not save changes.");
  } finally { setBusy(false); render(); }
}

function hostSummary(site, matchingHostname = null) {
  const list = document.createElement("ul");
  list.className = "host-summary";
  for (const host of site.hosts) {
    const item = document.createElement("li");
    item.textContent = host.hostname;
    if (host.hostname === matchingHostname) {
      item.className = "matching-host";
      item.setAttribute("aria-current", "true");
    }
    list.append(item);
  }
  return list;
}

function permissionWarning(site) {
  const warning = document.createElement("div");
  warning.className = "permission-warning";
  warning.append(paragraph("Site access required."));
  const grant = document.createElement("button");
  grant.type = "button";
  grant.textContent = "Grant access";
  grant.addEventListener("click", () => grantSite(site));
  warning.append(grant);
  return warning;
}

function editSiteTrigger(site) {
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "site-edit-trigger";
  trigger.setAttribute("aria-label", `Edit ${site.name} site`);
  const heading = document.createElement("span");
  heading.className = "site-card-heading";
  const name = document.createElement("span");
  name.className = "site-card-name";
  name.textContent = site.name;
  const icon = document.createElement("span");
  icon.className = "edit-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "✎";
  heading.append(name, icon);
  trigger.append(heading, hostSummary(site));
  trigger.addEventListener("click", () => openForm(createSiteForm({ site })));
  return trigger;
}

function siteRemoveControl(site) {
  const container = document.createElement("div");
  container.className = "site-remove-area";
  if (pendingDeleteSiteId === site.id) {
    const prompt = paragraph(`Remove ${site.name}?`, "remove-prompt");
    const actions = document.createElement("div");
    actions.className = "inline-confirm-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary compact-action";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => { pendingDeleteSiteId = null; render(); });
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "danger compact-action";
    confirm.textContent = "Remove";
    confirm.setAttribute("aria-label", `Confirm remove ${site.name}`);
    confirm.addEventListener("click", () => removeSite(site.id));
    actions.append(cancel, confirm);
    container.append(prompt, actions);
  } else {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "site-remove-button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${site.name}`);
    remove.addEventListener("click", () => { pendingDeleteSiteId = site.id; render(); });
    container.append(remove);
  }
  return container;
}

async function removeSite(siteId) {
  if (busy) return;
  setBusy(true, "Removing site…");
  showError();
  try {
    await command(MESSAGE_TYPE.DELETE_SITE, { expectedRevision: state.revision, siteId });
    pendingDeleteSiteId = null;
    view = VIEW.CURRENT;
    await refresh();
  } catch (error) {
    await refreshIfStale(error);
    showError("Could not remove site.");
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
      paragraph(`Matching host: ${model.hostname}`, "hostname matching-label"),
      hostSummary(model.currentSite, model.hostname),
    );
    elements.currentContent.append(profileSelect(
      model.currentSite.profile,
      !state.enabled || busy,
      (profile) => quickProfile(model.currentSite.id, profile),
      "current-profile",
    ));
    if (!state.enabled) elements.currentContent.append(paragraph(`${labelProfile(model.currentSite.profile)} selected — Global OFF`));
    if (!model.currentPermissionReady) {
      elements.currentContent.append(permissionWarning(model.currentSite));
    }
  }

  elements.siteList.replaceChildren();
  elements.otherSites.hidden = state.sites.length === 0;
  elements.otherSitesSummary.textContent = `Sites · ${state.sites.length}`;
  for (const site of state.sites) {
    const item = document.createElement("li");
    item.className = "site-card";
    const top = document.createElement("div");
    top.className = "site-card-top";
    if (pendingDeleteSiteId === site.id) top.classList.add("is-confirming");
    top.append(editSiteTrigger(site), siteRemoveControl(site));
    item.append(top);
    item.append(profileSelect(
      site.profile,
      !state.enabled || busy,
      (profile) => quickProfile(site.id, profile),
      `site-profile-${site.id}`,
    ));
    if (!model.permissionReadyBySiteId[site.id]) item.append(permissionWarning(site));
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
    profile: elements.formProfile.value,
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
    remove.setAttribute("aria-label", `Remove host ${index + 1}`);
    remove.disabled = form.hosts.length <= 1;
    remove.addEventListener("click", () => {
      syncFormFromDom();
      form = removeHostRow(form, index);
      renderForm();
    });
    row.append(label, input, remove);
    elements.hostList.append(row);
  });
  elements.formProfile.value = form.profile;
  elements.formProfile.disabled = busy;
}

function render() {
  if (!state || !model) return;
  elements.globalState.textContent = state.enabled ? "On" : "Off";
  elements.globalToggle.checked = state.enabled;
  elements.globalToggle.setAttribute("aria-checked", String(state.enabled));
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

async function grantSite(site) {
  if (busy || !site) return;
  setBusy(true, "Requesting site access…");
  showError();
  const hosts = site.hosts.map((host) => host.hostname);
  const permissionPromise = requestExactHostAccess(hosts, permissions);
  try {
    if (!(await permissionPromise)) return showError("Site access was not granted.");
    await command(MESSAGE_TYPE.RECONCILE);
    await refresh();
  } catch { showError("Could not grant site access."); }
  finally { setBusy(false); render(); }
}

elements.globalToggle.addEventListener("change", async () => {
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

refresh().then(() => {
  elements.status.textContent = "";
  elements.app.setAttribute("aria-busy", "false");
}).catch(() => {
  elements.status.textContent = "";
  showError("Could not load MDPS.");
});
