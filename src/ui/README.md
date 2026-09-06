# Product UI

## English

The MVP product UI is one responsive, English-only action popup. `popup-model.js` and `popup-actions.js` keep host/view/form and permission sequencing testable without a DOM. `popup.js` is the browser entry point: it uses the active-tab and permissions adapters plus the Phase 6 allowlisted runtime messages. It never accepts or emits arbitrary User-Agent values, headers, DNR rules, rule IDs, raw persisted state, telemetry, or network requests.

There is no separate Settings or options page. Current Site, Other Sites, and Add/Edit views share the popup. Permission requests begin directly in Save or Grant Access gestures; runtime commit follows only after exact-origin post-condition success.

## 日本語

MVP製品UIはresponsiveで英語のみのaction popup 1つである。`popup-model.js`と`popup-actions.js`によりhost/view/formとpermission実行順をDOMなしで検証可能にする。`popup.js`はbrowser entry pointであり、active-tab/permissions adapterとPhase 6のallowlist済みruntime messageを使う。任意User-Agent、header、DNR rule、rule ID、raw persisted state、telemetry、network requestを受け付けず送信しない。

別Settings/options pageは設けない。Current Site、Other Sites、Add/Edit viewをpopup内で共有する。permission requestはSaveまたはGrant Access gestureから直接開始し、exact-origin post-condition成功後だけruntime commitを行う。

## English

This is the boundary for product settings/action UI and is intentionally empty in Phase 1. Later UI code uses adapters instead of calling Chrome APIs directly.
