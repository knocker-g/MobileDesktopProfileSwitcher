# Technical Investigation Plan / 技術調査計画

## 日本語

### 目的・baseline

Sony Xperia 1 V の Quetta Android で native narrow viewport を維持し、一般的な Desktop Chrome として成立する最小 identity を特定する。YouTube は既知の検証対象であり、専用 workaround は作らない。本フェーズは観測・A/B test 準備までで、Extension 実装は開始しない。

| Baseline | 固定条件 | 既知結果 |
|---|---|---|
| Native | 同一端末/Quetta、PC版サイト OFF、User-Agent Switcher and Manager OFF、Android native viewport | identity と機能結果は要実機観測 |
| Success | 同一端末/Quetta/account/network、PC版サイト OFF、native viewport、同 Extension ON、成功済み Desktop Chrome/Windows profile | YouTube Desktop Web、login、通常再生、Native Live Chat は成功確認済み |

両者で日時、Android/Quetta/Extension version、profile 設定表示、`innerWidth`/`innerHeight`/`devicePixelRatio`、account/network 条件を記録する。「設定値」と wire/page/Worker の「実測値」を分離し、Cookie、token、request body は採取しない。

### 観測手順

1. Native/Success の順序を交互にして各5回、fresh tab から測る。
2. 中立的な HTTPS first-party echo/test page で HTTP、Window、Dedicated Worker を同時観測する。Shared/Service Worker は利用可能時のみ別記し、registration/cache を管理する。
3. top-level `main_frame`、same-origin、cross-origin、redirect chain、first request を分ける。
4. YouTube では identity header/property と機能結果のみ観測し、payload、Cookie、Authorization、visitorData は保存しない。
5. baseline 差分確定後に test value を作る。Chrome version、brand順序/GREASE、platform version は推測しない。

### 試験順序

詳細は `IDENTITY_AB_TEST_MATRIX.md` を正とする。一度に一変数を原則とし、不可避な整合 tuple は compound test と明記して直後に ablation する。

- O-N/O-S: 無変更の Native/Success を観測。
- A1: Successで実測した `User-Agent` を `main_frame` のみに設定。
- A2: A1が不安定な場合だけ、同じ値を same-origin request へ拡張（値でなくscopeの試験）。
- B系列: Successと差がある low-entropy UA-CH を一項目ずつ追加。暫定順は `Sec-CH-UA-Mobile`、`Sec-CH-UA-Platform`、`Sec-CH-UA` だが、観測差分とQuettaのDNR能力で確定する。
- C系列: HTTPだけで不足する場合のみ、差のある legacy `navigator` propertyを一つずつ追加。`vendor`/`product`が同値なら省略。
- D系列: `navigator.userAgentData` low entropy、high entropy、Workerの必要性を順に診断。supported MV3 APIで堅牢に再現不能なsurfaceが必須ならNO-GO候補。
- E-min: 成功した最小集合だけをclean stateから再構成。Successの全差分を無条件に複製しない。

各追加後、その要素だけを外すablationとDefault復帰を行う。前段が全項目を満たせば後段へ進まない。

### 共通判定

各runをPass/Fail/Not observedで記録する: native CSS viewport維持、Desktop Web、login、通常動画、Native Live Chat、reload、same-tab navigation、new tab、Quetta再起動、許可範囲外へのrule漏れなし、Default/revoke後の完全復帰、中立pageと少なくとも3種類の一般siteで明白な破綻なし。Desktop WebとLive Chatは別outcomeにする。一時的障害は同時間帯のNative/Success control再試験なしにidentity failureと断定しない。

### Manifest V3 capability

DNR `modifyHeaders`/`set` はrequest header候補だが、各UA-CH headerがQuettaで変更できるか要実機確認。permissionは `declarativeNetRequestWithHostAccess` + `optional_host_permissions` を第一候補とする。

`scripting` + `world: "MAIN"` はWindow propertyの候補にすぎず専用identity APIではない。pageから干渉可能で、WorkerNavigatorやbrowser内部UA metadataを変えない。`document_start`も全page code/Workerより先の絶対保証ではない。isolated worldではpageが読む`navigator`を変えられない。

公式Extension APIでは、`navigator.userAgentData`、high-entropy値、Worker identityをbrowser-levelで一括整合するsupported手段は確認できない。CDPは対象外。

### 境界とTechnical Gate

youtubei payload、`clientName`/`clientVersion`、visitorData、Cookie、Authorization、OAuth、endpoint別identity、HTTP error起点切替、proxy/IP、randomization、service-specific workaround、unsupported API、Worker constructor hook、広範prototype patch、remote codeを扱わない。

GOには次の全条件が必要: (1) Desktop Webの最小identity/scopeをablationで特定、(2) Live Chatの追加差分または追加不要を説明、(3) 必須差分をdocumented/supported MV3 APIで再現、(4) service spoof/invasive patch不要、(5) excessive permission不要、(6) lifecycle/general-site試験合格、(7) CWSのsingle purpose/minimum permission/user control/privacyと整合。現在は未観測のため **CONDITIONAL GO**。必須差分がsupported APIで再現不能または禁止変更が必要なら **NO-GO**。

### 一次資料

[`chrome.declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)、[`chrome.permissions`](https://developer.chrome.com/docs/extensions/reference/api/permissions)、[Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)、[`chrome.scripting`](https://developer.chrome.com/docs/extensions/reference/api/scripting)、[UA-CH specification](https://wicg.github.io/ua-client-hints/)、[Chrome UA-CH guide](https://developer.chrome.com/docs/privacy-security/user-agent-client-hints)。

## English

### Objective and baselines

Identify the minimum general Desktop Chrome identity on Quetta Android/Sony Xperia 1 V while retaining the native narrow viewport. YouTube is a known validation target, not a reason for service-specific behavior. This phase stops at observation and A/B-test readiness.

Native fixes the same device/Quetta with Desktop Site OFF, User-Agent Switcher and Manager OFF, and native viewport; all identity and functional values require device observation. Success fixes the same device/Quetta/account/network and viewport with the proven Desktop Chrome/Windows profile ON; Desktop Web, login, playback, and Native Live Chat are user-confirmed. Record versions, time, displayed profile configuration, viewport, account, and network. Separate configured from measured wire/page/Worker values; never collect cookies, tokens, or bodies.

### Observation and sequence

Alternate Native/Success for five fresh-tab runs each. Use a neutral HTTPS first-party echo/test page for HTTP, Window, and Dedicated Worker; record Shared/Service Workers separately when available. Separate main-frame, same-origin, cross-origin, redirect, and first-request observations. On YouTube collect identity and outcomes only. Never guess versions, brand order/GREASE, or platform versions.

The authoritative sequence is in `IDENTITY_AB_TEST_MATRIX.md`: O controls; A1 measured Success UA on main frame; A2 same-origin scope only if required; B adds only differing low-entropy hints individually; C adds only differing legacy Window fields if HTTP is insufficient; D diagnoses `userAgentData`, high entropy, and Worker necessity; E-min rebuilds only the proven minimum. Use one variable per test, label unavoidable tuples as compound, immediately ablate, and stop when all outcomes pass.

### Outcomes and MV3 capability

Record Pass/Fail/Not observed for unchanged viewport, Desktop Web, login, playback, Native Live Chat, reload, same-tab, new-tab, Quetta restart, origin scope/cleanup, and regressions on a neutral page plus three general-site classes. Treat Desktop Web and Live Chat separately and rerun controls for transient failures.

DNR header `set` and `declarativeNetRequestWithHostAccess` plus optional host grants are candidates requiring Quetta validation. MAIN-world scripting is not a dedicated identity API, is page-interferable, does not cover Worker/browser metadata, and has no absolute earliest-execution guarantee. Reviewed official Extension APIs do not confirm an atomic browser-level override for `userAgentData`, high entropy, and Worker identity; CDP is excluded.

### Boundaries and Technical Gate

All prohibited variables and seven GO conditions are identical to the Japanese section. Current status is **CONDITIONAL GO** because values remain unmeasured; use **NO-GO** if a required difference is unsupported or requires prohibited behavior.

### Primary sources

The six primary-source links above apply identically.
