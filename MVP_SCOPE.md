# MVP Scope / MVP 範囲

## 日本語

含む: `Default`/`Desktop`/`Mobile`、1 Site=複数明示host+1 profile、同一hostのSite間重複禁止、Global ON/OFF、exact optional host permission、現在host prefill、Site CRUD、local-only storage、storage→DNR reconciliation、PC/Android responsive UI、診断用手動checklist。

MVP 完了条件: 最小 A/B test 合格、Quetta Android と Desktop Chrome で rule lifecycle/permission revoke/restore を確認、YouTube Desktop Web と Native Live Chat の結果を再現可能に記録、identity inconsistency を許容基準内に限定、CWS policy review checklist 合格。

含まない: custom editor、UA/OS/browser versionの大量選択、実行中majorへの追従、latest version取得、動的UA生成、任意version指定、all-site install grant、service-specific logic、remote service。

### 調査反映後のMVP候補

Desktop/Mobile ruleは明示hostごとのdynamic rule、`main_frame`、UA-onlyとする。DefaultとGlobal OFFはruleなし。storageをsource of truthとし、Global OFF時は全dynamic ruleを削除、ON時は再生成する。permissionは登録hostのHTTP/HTTPS exact originだけをuser gesture内で取得し、Default/OFFでは保持、host/Site削除後に解放する。

製品scopeはAndroid ChromiumとPC Chromiumの両方を含む。`Desktop`と`Mobile`は同一milestoneの検証済みProfile Setから供給し、製品に同梱する。runtime外部取得やremote configurationは使わない。最初の製品milestone選定と一般site互換性は実装前gateとして残る。

## English

Includes `Default`/`Desktop`/`Mobile`; one Site with multiple explicit hosts and one profile; cross-Site host uniqueness; Global ON/OFF; exact optional host grants; current-host prefill; Site CRUD; local-only storage; storage-to-DNR reconciliation; responsive PC/Android UI; and a manual diagnostic checklist.

MVP completion requires passing the minimal A/B test, validating rule lifecycle/permission revoke/restore on Quetta Android and desktop Chrome, reproducibly recording YouTube Desktop Web and Native Live Chat results, bounding identity inconsistency, and passing the CWS policy checklist.

Excluded: custom editing; large UA/OS/browser-version catalogs; tracking the running major; latest-version lookup; dynamic UA generation; arbitrary version input; install-time all-site grants; service-specific logic; and remote services.

### Post-investigation MVP candidate

Desktop/Mobile use one dynamic UA-only `main_frame` rule per explicit host. Default and Global OFF have no rule. Storage is authoritative; Global OFF removes all dynamic rules and ON regenerates them. Request only exact HTTP/HTTPS origins for registered hosts in a user gesture, retain grants under Default/OFF, and release them after host/Site deletion.

Product scope includes both Android and desktop Chromium. Desktop and Mobile come from one bundled Verified Profile Set at the same milestone. No runtime external lookup or remote configuration is used. Selecting the first product milestone and validating general-site compatibility remain pre-implementation gates.
