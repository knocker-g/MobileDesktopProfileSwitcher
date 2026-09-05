# MVP Scope / MVP 範囲

## 日本語

含む: `Default`、検証済みUA-only方式の`Desktop`と`Mobile`、current origin の明示 permission request、一時適用、origin ごとの記憶、global default（許可済み origin にのみ有効）、Apply & Reload、設定一覧/削除、local-only storage、Android mobile-first popup、Desktop 対応、診断用の手動 test checklist。

MVP 完了条件: 最小 A/B test 合格、Quetta Android と Desktop Chrome で rule lifecycle/permission revoke/restore を確認、YouTube Desktop Web と Native Live Chat の結果を再現可能に記録、identity inconsistency を許容基準内に限定、CWS policy review checklist 合格。

含まない: custom editor、UA/OS/browser versionの大量選択、実行中majorへの追従、latest version取得、動的UA生成、任意version指定、all-site install grant、service-specific logic、remote service。

### 調査反映後のMVP候補

YouTubeで検証済みの第一候補は、明示的な`www.youtube.com`/`m.youtube.com` host集合、`main_frame`、Desktop UA-only、自動適用である。URL rewrite、強制navigation、UA-CH、navigator/Worker patchは含めない。host permissionはユーザー登録hostに対するoptional grantとし、`<all_urls>`やwildcard subdomainを前提にしない。

製品scopeはAndroid ChromiumとPC Chromiumの両方を含む。`Desktop`と`Mobile`は同一milestoneの検証済みProfile Setから供給し、製品に同梱する。runtime外部取得やremote configurationは使わない。最初の製品milestone選定と一般site互換性は実装前gateとして残る。

## English

Includes: `Default`, plus validated-UA-only `Desktop` and `Mobile`; explicit current-origin permission; temporary use; remembered per-origin settings; global default effective only on granted origins; Apply & Reload; settings list/deletion; local-only storage; Android-first popup; desktop support; and a manual diagnostic checklist.

MVP completion requires passing the minimal A/B test, validating rule lifecycle/permission revoke/restore on Quetta Android and desktop Chrome, reproducibly recording YouTube Desktop Web and Native Live Chat results, bounding identity inconsistency, and passing the CWS policy checklist.

Excluded: custom editing; large UA/OS/browser-version catalogs; tracking the running major; latest-version lookup; dynamic UA generation; arbitrary version input; install-time all-site grants; service-specific logic; and remote services.

### Post-investigation MVP candidate

The validated YouTube candidate uses the explicit `www.youtube.com`/`m.youtube.com` host set, `main_frame`, Desktop UA-only, and automatic application. It excludes URL rewriting, forced navigation, UA-CH changes, and navigator/Worker patching. Request optional host grants only for user-registered hosts; never assume `<all_urls>` or wildcard subdomains.

Product scope includes both Android and desktop Chromium. Desktop and Mobile come from one bundled Verified Profile Set at the same milestone. No runtime external lookup or remote configuration is used. Selecting the first product milestone and validating general-site compatibility remain pre-implementation gates.
