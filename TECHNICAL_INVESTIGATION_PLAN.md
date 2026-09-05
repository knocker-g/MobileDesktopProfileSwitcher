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
- A1: Successで実測した `User-Agent` を`www.youtube.com`の`main_frame`のみに設定。今回の実機/buildでwire・全機能・fresh-navigation再現・OFF復帰が**PASS**。
- A2: A1が不安定な場合だけ、同じ値を same-origin request へ拡張（値でなくscopeの試験）。
- B系列: CAP-Hで独立変更可能と実証済みのlow-entropy UA-CHを一項目ずつ追加。順序は `Sec-CH-UA-Mobile`、`Sec-CH-UA-Platform`、`Sec-CH-UA` とする。
- C系列: HTTPだけで不足する場合のみ、差のある legacy `navigator` propertyを一つずつ追加。`vendor`/`product`が同値なら省略。
- D系列: `navigator.userAgentData` low entropy、high entropy、Workerの必要性を順に診断。supported MV3 APIで堅牢に再現不能なsurfaceが必須ならNO-GO候補。
- E-min: 成功した最小集合だけをclean stateから再構成。Successの全差分を無条件に複製しない。

各追加後、その要素だけを外すablationとDefault復帰を行う。前段が全項目を満たせば後段へ進まない。

### 共通判定

各runをPass/Fail/Not observedで記録する: native CSS viewport維持、Desktop Web、login、通常動画、Native Live Chat、reload、same-tab navigation、new tab、Quetta再起動、許可範囲外へのrule漏れなし、Default/revoke後の完全復帰、中立pageと少なくとも3種類の一般siteで明白な破綻なし。Desktop WebとLive Chatは別outcomeにする。一時的障害は同時間帯のNative/Success control再試験なしにidentity failureと断定しない。

### Manifest V3 capability

DNR `modifyHeaders`/`set` による4headerの独立変更は、今回のQuetta実機/buildでCAP-H PASSを確認済み。製品permission設計は `declarativeNetRequestWithHostAccess` + `optional_host_permissions` を第一候補とする。

`scripting` + `world: "MAIN"` はWindow propertyの候補にすぎず専用identity APIではない。pageから干渉可能で、WorkerNavigatorやbrowser内部UA metadataを変えない。`document_start`も全page code/Workerより先の絶対保証ではない。isolated worldではpageが読む`navigator`を変えられない。

公式Extension APIでは、`navigator.userAgentData`、high-entropy値、Worker identityをbrowser-levelで一括整合するsupported手段は確認できない。CDPは対象外。

### 境界とTechnical Gate

youtubei payload、`clientName`/`clientVersion`、visitorData、Cookie、Authorization、OAuth、endpoint別identity、HTTP error起点切替、proxy/IP、randomization、service-specific workaround、unsupported API、Worker constructor hook、広範prototype patch、remote codeを扱わない。

GOには次の全条件が必要: (1) Desktop Webの最小identity/scopeをablationで特定、(2) Live Chatの追加差分または追加不要を説明、(3) 必須差分をdocumented/supported MV3 APIで再現、(4) service spoof/invasive patch不要、(5) excessive permission不要、(6) lifecycle/general-site試験合格、(7) CWSのsingle purpose/minimum permission/user control/privacyと整合。YouTube A/S1はUA-onlyで(1)〜(5)の対象条件を満たした。一般site、lifecycle、product UA/version、CWS評価が残るため現在は **CONDITIONAL GO**。

### 一次資料

[`chrome.declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)、[`chrome.permissions`](https://developer.chrome.com/docs/extensions/reference/api/permissions)、[Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)、[`chrome.scripting`](https://developer.chrome.com/docs/extensions/reference/api/scripting)、[UA-CH specification](https://wicg.github.io/ua-client-hints/)、[Chrome UA-CH guide](https://developer.chrome.com/docs/privacy-security/user-agent-client-hints)。

### HTTP wire観測フェーズ

JavaScript-visible identityがNative/Successで不変だったためHTTP wireを実測した。Quetta tabのUSB remote debugging target公開とDevTools Network観測は確認済みで、詳細手順、記録template、privacy境界は`HTTP_WIRE_IDENTITY_INVESTIGATION.md`を正とする。

実測により、対象Quetta buildのremote debuggingとDevTools Network利用は確認済み。initial `main_frame`の4headerはすべてDesktop Chrome/Windowsへchangedし、Success same-origin JavaScript requestも同じ4値だった。その後A/S1がUA-onlyで成立・再現したためAで停止した。Chrome 154はexperiment fixtureでありproduct defaultではない。

### DNR capability gate

CAP-H実機試験により、対象Quetta Android実機/buildでは`User-Agent`、`Sec-CH-UA`、`Sec-CH-UA-Mobile`、`Sec-CH-UA-Platform`のruleが個別に受理され、runtime errorなく対象`main_frame`のwire値を変更できた。他の3headerは各試験でNative値を維持し、最終OFF復帰もPASSした。従って当該環境の「DNRでUA-CHを変更できない可能性」というcapability gateは解消した。全Chromium Android browserへの一般保証ではなく、headerの機能上の必要性も未確定である。

- `User-Agent`: CAP-H-UA **PASS**。
- `Sec-CH-UA`: CAP-H-CH-UA **PASS**。
- `Sec-CH-UA-Mobile`: CAP-H-CH-Mobile **PASS**。
- `Sec-CH-UA-Platform`: CAP-H-CH-Platform **PASS**。

A/S1はactual wire、Desktop Web、native viewport、login、動画再生、Native Live Chat、chat入力、fresh-navigation再現、OFF recoveryが**PASS**した。さらに`www.youtube.com`と`m.youtube.com`の明示的2hostへUA-only `main_frame` ruleを適用すると、既存Mobile tabの通常reloadでも同じ機能が成立し、YouTube自身がdesktop URLへ移行した。UA-CHとPage/Worker identityはNativeのまま。B/C/D/S2、Extension側canonicalization/強制navigationは不要。UA-only multi-host site profileを製品MVP第一候補とするが、Chrome 154はproduct defaultではない。

PC Chromeの通常viewportで逆方向のMobile Profileも実測した。明示的2hostの`main_frame`へMobile Chrome / Android fixtureのUAだけを適用すると、Mobile Web、viewport維持、動画再生がPASSし、YouTube自身が`m.youtube.com`へ移行した。Native Live Chatと入力欄の非表示はMobile Web設計上の期待結果でありFAILではない。Extension側URL変換は不要だった。従って`Default`（変更なし）、`Desktop`（Desktop UA-only）、`Mobile`（Mobile UA-only）をMVP profileの第一候補とする。fixture version管理、一般site、lifecycle、CWS評価が残るため全体判定は引き続き **CONDITIONAL GO**。

## English

### Objective and baselines

Identify the minimum general Desktop Chrome identity on Quetta Android/Sony Xperia 1 V while retaining the native narrow viewport. YouTube is a known validation target, not a reason for service-specific behavior. This phase stops at observation and A/B-test readiness.

Native fixes the same device/Quetta with Desktop Site OFF, User-Agent Switcher and Manager OFF, and native viewport; all identity and functional values require device observation. Success fixes the same device/Quetta/account/network and viewport with the proven Desktop Chrome/Windows profile ON; Desktop Web, login, playback, and Native Live Chat are user-confirmed. Record versions, time, displayed profile configuration, viewport, account, and network. Separate configured from measured wire/page/Worker values; never collect cookies, tokens, or bodies.

### Observation and sequence

Alternate Native/Success for five fresh-tab runs each. Use a neutral HTTPS first-party echo/test page for HTTP, Window, and Dedicated Worker; record Shared/Service Workers separately when available. Separate main-frame, same-origin, cross-origin, redirect, and first-request observations. On YouTube collect identity and outcomes only. Never guess versions, brand order/GREASE, or platform versions.

The authoritative sequence is in `IDENTITY_AB_TEST_MATRIX.md`. A1 set only the measured Success UA on the `www.youtube.com` main frame and passed wire validation, all functional outcomes, fresh-navigation reproduction, and OFF recovery on this device/build. The sequence therefore stopped at A; B/C/D/S2 and JavaScript/Worker changes were not needed for this success condition.

### Outcomes and MV3 capability

Record Pass/Fail/Not observed for unchanged viewport, Desktop Web, login, playback, Native Live Chat, reload, same-tab, new-tab, Quetta restart, origin scope/cleanup, and regressions on a neutral page plus three general-site classes. Treat Desktop Web and Live Chat separately and rerun controls for transient failures.

CAP-H confirmed independent DNR `modifyHeaders`/`set` modification of all four headers on the tested Quetta device/build. Product permission design should prefer `declarativeNetRequestWithHostAccess` plus optional host grants. MAIN-world scripting is not a dedicated identity API, is page-interferable, does not cover Worker/browser metadata, and has no absolute earliest-execution guarantee. Reviewed official Extension APIs do not confirm an atomic browser-level override for `userAgentData`, high entropy, and Worker identity; CDP is excluded.

### Boundaries and Technical Gate

All prohibited variables and seven GO conditions are identical to the Japanese section. YouTube A/S1 satisfies the relevant first five conditions with UA-only on this device/build. Overall status remains **CONDITIONAL GO** pending general-site, lifecycle, product-UA/version, and CWS validation.

### Primary sources

The six primary-source links above apply identically.

### HTTP wire observation phase

Because JavaScript-visible identity was unchanged between Native and Success, HTTP wire identity was measured directly. Quetta tab exposure as a USB remote-debugging target and DevTools Network observation are confirmed. `HTTP_WIRE_IDENTITY_INVESTIGATION.md` remains authoritative for steps, recording, and privacy boundaries.

Observation confirmed remote debugging and DevTools Network on the tested Quetta build. All four initial-main-frame headers changed to Desktop Chrome/Windows, and the Success same-origin JavaScript request used the same four values. A/S1 subsequently succeeded and reproduced with UA-only, so the sequence stopped at A. Chrome 154 is an experiment fixture, not a product default.

### DNR capability gate

CAP-H device testing showed that the tested Quetta Android device/build accepted separate rules for `User-Agent`, `Sec-CH-UA`, `Sec-CH-UA-Mobile`, and `Sec-CH-UA-Platform` and changed each selected `main_frame` wire value without runtime errors. The other three headers stayed Native in every isolated test, and final OFF restoration passed. This resolves the DNR UA-CH capability concern for this environment only; it is not a guarantee for all Chromium Android browsers and does not establish functional necessity.

CAP-H-UA, CAP-H-CH-UA, CAP-H-CH-Mobile, and CAP-H-CH-Platform are all **PASS**. A/S1 passed wire and every functional outcome. The same UA-only main-frame rule on the explicit `www.youtube.com` plus `m.youtube.com` host set also passed an existing-Mobile-tab reload, after which YouTube moved itself to the desktop URL. UA-CH and Page/Worker identity stayed Native. A UA-only multi-host site profile is the first product-MVP candidate; B/C/D/S2 and extension-side canonicalization/forced navigation are unnecessary for this YouTube condition. Chrome 154 is not a product default.

The reverse Mobile Profile was also observed on PC Chrome at normal viewport. Applying only the Mobile Chrome/Android fixture UA to `main_frame` on the two explicit hosts passed Mobile Web, viewport retention, and playback, and YouTube itself moved to `m.youtube.com`. Hidden Native Live Chat and chat input are expected Mobile Web behavior, not failures. No extension URL transformation was needed. Therefore `Default` (no change), `Desktop` (Desktop UA-only), and `Mobile` (Mobile UA-only) are the first MVP-profile candidates. Fixture-version management, general-site behavior, lifecycle, and CWS review remain open, so the overall status stays **CONDITIONAL GO**.
