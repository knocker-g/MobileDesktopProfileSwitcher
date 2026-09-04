# Identity A/B Test Matrix / Identity A/Bテストマトリクス

## 日本語

### 記録ルール

`要実機観測` は未知値であり推測で埋めない。Success profile UIで既知の値は「設定値」とし、wire/page/Workerで再測定する。各値にrun ID、時刻、Quetta/Android/Extension version、context、top-level originを付ける。secret、Cookie、Authorization、bodyは記録しない。

### Identity観測表

| 項目 | 観測方法 | Native値 | Success値 | 差分 | MV3再現 | 候補API | Desktop必要性 | Live Chat必要性 | A/B | 判定 |
|---|---|---|---|---|---|---|---|---|---|---|
| HTTP `User-Agent` | HTTPS echo+DevTools、first navigation分離 | 要実機観測 | 設定値Windows NT 10.0/Win64/x64/Chrome 154…、wireは要実機観測 | 要実機観測 | 候補、要Quetta確認 | DNR `set` | 有力・未確定 | 候補・因果未確定 | 可 | 最初に単独試験 |
| `Sec-CH-UA` | 生値、brand順序/version保存 | 要実機観測 | 要実機観測 | 要実機観測 | header候補、整合未確認 | DNR `set` | 要観測 | 要観測 | 可 | 差がある時のみ |
| `Sec-CH-UA-Mobile` | echo+DevTools | 要実機観測 | 要実機観測 | 要実機観測 | header候補、要実機 | DNR `set` | 有力・未確定 | 要観測 | 可 | low entropy第一候補 |
| `Sec-CH-UA-Platform` | echo+DevTools | 要実機観測 | 要実機観測 | 要実機観測 | header候補、要実機 | DNR `set` | 候補 | 候補 | 可 | 差があれば試験 |
| high entropy HTTP UA-CH | 必要最小`Accept-CH`の中立page | 要実機観測 | 要実機観測 | 要実機観測 | browser metadata一括整合APIなし | DNR能力試験のみ | 不明 | 不明 | 条件付 | low entropy不足時のみ |
| `navigator.userAgent` | page MAIN world | 要実機観測 | 要実機観測 | 要実機観測 | Windowのみ候補 | `scripting`/MAIN | 不明 | 不明 | 可 | HTTP不足時のみ |
| `navigator.platform` | page MAIN world | 要実機観測 | 設定値`Win32`、実測要 | 要実機観測 | Windowのみ候補 | `scripting`/MAIN | 不明 | 不明 | 可 | 差があれば |
| `navigator.vendor` | page MAIN world | 要実機観測 | 設定値`Google Inc.`、実測要 | 要実機観測 | Windowのみ候補 | `scripting`/MAIN | 未確定 | 不明 | 可 | 同値なら除外 |
| `navigator.product` | page MAIN world | 要実機観測 | 設定値`Gecko`、実測要 | 要実機観測 | Windowのみ候補 | `scripting`/MAIN | 未確定 | 不明 | 可 | 同値なら除外 |
| `navigator.appVersion` | page MAIN world | 要実機観測 | 要実機観測 | 要実機観測 | Windowのみ候補 | `scripting`/MAIN | 不明 | 不明 | 可 | UAと分離 |
| `navigator.userAgentData` shape | MAIN world+descriptor | 要実機観測 | 要実機観測 | 要実機観測 | 専用overrideなし | fragileなMAIN facadeのみ | 不明 | 不明 | 診断可 | 必須なら重大risk |
| `.brands` | exact array/順序 | 要実機観測 | 要実機観測 | 要実機観測 | browser-level整合なし | MAIN候補のみ | 不明 | 不明 | 診断可 | HTTPとの一致評価 |
| `.mobile` | boolean | 要実機観測 | 要実機観測 | 要実機観測 | browser-level整合なし | MAIN候補のみ | 有力・未確定 | 不明 | 診断可 | 個別確認 |
| `.platform` | string | 要実機観測 | 要実機観測 | 要実機観測 | browser-level整合なし | MAIN候補のみ | 候補 | 不明 | 診断可 | headerとの一致評価 |
| `getHighEntropyValues()` | architecture/bitness/formFactors/fullVersionList/model/platformVersion/wow64 | 要実機観測 | 要実機観測 | 要実機観測 | supported一括override未確認 | なし（CDP対象外） | 不明 | 不明 | 観測のみ | 必須ならNO-GO候補 |
| Worker legacy identity | same-origin Dedicated Workerから観測 | 要実機観測 | 要実機観測 | 要実機観測 | supported browser-level override未確認 | なし | 不明 | 不明 | 観測可 | 必須ならNO-GO候補 |
| Worker `userAgentData` | Dedicated、可能時Shared/Serviceを別記 | 要実機観測 | 要実機観測 | 要実機観測 | supported browser-level override未確認 | なし | 不明 | 不明 | 観測可 | Window差も記録 |

DNRの一般的header設定能力、Quettaで対象UA-CHを変更できるか、JS/Workerと整合するかは別の問いである。「候補」は実装決定ではない。

### 段階試験

| ID | 前提 | 今回だけ変えるもの | scope | 目的/次の判断 |
|---|---|---|---|---|
| O-N/O-S | clean baseline | なし/既存Extension ON | 実挙動を観測 | 各5回で値・差分・noise確定 |
| CAP-H | 中立test fixture | headerごとの無害な識別値 | test originのみ | Quetta DNR能力確認 |
| A1 | Native | Success実測UA | `main_frame` | 単独効果。成功ならablation A1- |
| A2 | A1不安定時 | UAのscopeのみ | same-originへ拡張 | subresource必要性。cross-origin禁止 |
| B1 | A最小 | 実測`Sec-CH-UA-Mobile` | 直前と同じ | 追加後B1-で除去 |
| B2 | B1必要時 | 実測`Sec-CH-UA-Platform` | 同じ | B2- ablation |
| B3 | B2必要時 | 実測`Sec-CH-UA` | 同じ | B3- ablation |
| B4 | low entropy不足時 | 差のあるhigh entropy headerを1つ | 中立page→対象 | Accept-CH/context記録 |
| C1/C2/C3 | HTTP不足時 | `userAgent`/`platform`/`appVersion`を各別run | granted top frame MAIN | 各追加直後に除去 |
| C4/C5 | baseline差あり時 | `vendor`/`product`を各別run | 同じ | 同値なら省略 |
| D1/D2/D3 | Cでも不足 | UAData `mobile`/`platform`/`brands`を各別診断 | Window | facade必須ならrisk評価 |
| D4 | なお不足 | high entropy差を1項目ずつ診断 | Window | supported APIなしならNO-GO候補 |
| W1 | Window最小成立後 | Workerは変更せず観測 | Worker | identity漏れで機能が壊れるか |
| E-min | clean state | 証明済み最小集合 | 最小scope | 全再現性試験→Technical Gate |

B順序は暫定。O-N/O-Sで差がない項目は飛ばす。browserが不整合な中間値を拒否する場合だけ、実測low-entropy tupleをcompound testとして追加し、各要素のablationを行う。

### Run sheet・判定

各ID×5runで、環境/version/time/network、viewport/DPR/orientation、設定値と実測identity、YouTubeのDesktop/login/playback/Live Chat/error、初回/reload/same-tab/new-tab/restart、echo+一般site 3分類、Default/revoke/rule消去後の復帰、Pass/Fail/Not observedと証拠を記録する。

GOはE-minが全項目を満たし、各必須要素がablationで説明され、supported MV3 APIとoptional per-origin permissionだけで成立する場合。Worker/high entropyのinvasive patch、service client spoof、excessive permissionが必要ならNO-GO。現在は **CONDITIONAL GO**。

禁止変数: youtubei payload、`clientName`/`clientVersion`、visitorData、Cookie、Authorization、OAuth、service-specific workaround、endpoint別identity、401/403/429起点切替、proxy/IP、randomization。

### Baseline実測による更新（2026-09-04）

`native-01..05`と`success-01..05`を解析した結果、timestamp以外は各baseline内で5回完全一致し、NativeとSuccess間も完全一致した。すべてのstatusは`available`で、PageとWorkerの共通surfaceも一致した。したがって先行するIdentity観測表の「要実機観測」は、JavaScript-visible identityについて次の実測表で置き換える。HTTP wire欄は置き換えない。

| Surface | Native → Success | A/B分類 | 更新後の扱い |
|---|---|---|---|
| Page `userAgent`, `platform`, `vendor`, `product`, `appVersion` | unchanged | Probably unnecessary | Success成立時にもnative値のまま。JS patchを初期試験から除外 |
| Page `language`, `languages` | unchanged | Probably unnecessary | identity変更候補から除外 |
| Page UAData `brands`, `mobile`, `platform` | unchanged | Probably unnecessary | MAIN-world UAData patchを初期試験から除外 |
| Page high entropy全取得値 | unchanged | Probably unnecessary | 値のoverrideを試験しない |
| Worker `userAgent`, `platform` | unchanged | Probably unnecessary | Worker patchを設計しない |
| Worker UAData low/high entropy | unchanged | Probably unnecessary | Workerはnative identityのままSuccess成立 |
| HTTP `User-Agent` | JSONでは未観測 | Must test | wire Native/Success差分を最優先で観測し、その後A1/A2 |
| HTTP low-entropy UA-CH | JSONでは未観測 | Must test | `Sec-CH-UA*`をwireで実測後、差のあるfieldだけ個別試験 |
| HTTP high-entropy Client Hints | JSONでは未観測 | Cannot determine yet | server opt-inがあるrequestでのみ別観測 |

更新後の順序はO-N/O-SのHTTP wire観測 → A1 (`User-Agent`, `main_frame`) → 必要ならA2 (same-origin scope) → wireで差が実測されたUA-CHだけを一項目ずつ追加 → E-minとする。C/D/W系列は、HTTP系列が失敗し、かつ別の証拠が得られた場合にだけ再開する。

## English

### Recording rules and identity matrix

“Requires on-device observation” is unknown and must never be guessed. Label Success UI values as configured and remeasure wire/page/Worker values. Attach run ID, time, versions, context, and top-level origin; never record secrets, cookies, Authorization, or bodies.

The Japanese identity table is normative. Its exact English meaning is: measure HTTP UA and all low/high-entropy UA-CH in a neutral HTTPS echo plus DevTools; measure Window legacy fields and `userAgentData` in MAIN world; measure Dedicated Worker and, when available, Shared/Service Worker separately. Native and wire/page/Worker Success values all require observation. Only configured Success values are currently known: Windows NT 10.0/Win64/x64/Chrome 154… UA, `Win32`, `Google Inc.`, and `Gecko`. DNR header setting and MAIN-world Window scripting are candidates, not confirmed implementations. No reviewed supported Extension API provides an atomic browser-level override for high-entropy or Worker identity; if either is required, it is a NO-GO candidate.

### Staged tests

O-N/O-S establish five-run controls; CAP-H checks each header on a neutral origin; A1 tests measured UA on main frame; A2 changes only same-origin scope if needed; B1/B2/B3 add measured mobile/platform/brand hints separately; B4 tests one differing high-entropy header only if necessary; C1–C5 add differing legacy fields in separate runs; D1–D4 diagnose individual UAData requirements; W1 observes unmodified Worker leakage; E-min rebuilds the proven minimum. Immediately ablate each addition. Skip fields without a measured difference. Use a labeled compound low-entropy tuple only if the browser rejects intermediate states, then ablate each member.

### Run sheet, gate, and boundaries

For every ID×five runs record environment, viewport, configured versus measured identity, separate YouTube outcomes, lifecycle states, neutral plus three general-site classes, cleanup, and Pass/Fail/Not observed evidence. GO requires E-min to pass with every element explained by ablation and implemented only through supported MV3 APIs plus optional per-origin access. Invasive Worker/high-entropy patching, service spoofing, or excessive permission means NO-GO. Current status is **CONDITIONAL GO**.

The prohibited-variable list is identical to the Japanese section and must never be added to the matrix.

### Baseline measurement update (2026-09-04)

Analysis of `native-01..05` and `success-01..05` found exact five-run stability within each baseline after excluding timestamps, and exact equality between Native and Success. Every status was `available`; common Page and Worker surfaces also matched. This replaces the earlier “requires on-device observation” entries for JavaScript-visible identity, but does not replace any HTTP wire entry.

| Surface | Native → Success | A/B class | Updated handling |
|---|---|---|---|
| Page legacy navigator fields | unchanged | Probably unnecessary | Leave JS patching out of initial tests |
| Page language fields | unchanged | Probably unnecessary | Remove from identity-change candidates |
| Page UAData low entropy | unchanged | Probably unnecessary | Leave MAIN-world UAData patching out |
| Page high entropy | unchanged | Probably unnecessary | Do not test value overrides |
| Worker legacy identity | unchanged | Probably unnecessary | Do not design Worker patches |
| Worker UAData low/high entropy | unchanged | Probably unnecessary | Success works while Worker remains native |
| HTTP `User-Agent` | not observed by JSON | Must test | Measure wire difference first, then A1/A2 |
| HTTP low-entropy UA-CH | not observed by JSON | Must test | Measure `Sec-CH-UA*`, then test only differing fields |
| HTTP high-entropy Client Hints | not observed by JSON | Cannot determine yet | Observe separately only on opted-in requests |

The updated order is HTTP O-N/O-S observation, A1 (`User-Agent` on `main_frame`), A2 same-origin scope only if needed, individually adding only wire-observed UA-CH differences, then E-min. Resume C/D/W only if HTTP tests fail and new evidence justifies them.
