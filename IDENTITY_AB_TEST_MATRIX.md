# Identity A/B Test Matrix / Identity A/Bテストマトリクス

## 日本語

### 記録ルール

`要実機観測` は未知値であり推測で埋めない。Success profile UIで既知の値は「設定値」とし、wire/page/Workerで再測定する。各値にrun ID、時刻、Quetta/Android/Extension version、context、top-level originを付ける。secret、Cookie、Authorization、bodyは記録しない。

### Identity観測表

| 項目 | 観測方法 | Native値 | Success値 | 差分 | MV3再現 | 候補API | Desktop必要性 | Live Chat必要性 | A/B | 判定 |
|---|---|---|---|---|---|---|---|---|---|---|
| HTTP `User-Agent` | DevTools、first navigation分離 | Android Chrome 148 Mobile | Windows Chrome 154 fixture | changed | CAP-H/A-S1 PASS（今回のQuetta build） | DNR `set` | 今回の条件で十分 | 今回の条件で十分 | 可 | A/S1 wire/機能/再現PASS |
| `Sec-CH-UA` | DevTools、生値・brand順序/version保存 | Chromium/Quetta 148/Not Brand 99 | Not Brand 8/Chromium/Google Chrome 154 | changed | CAP-H PASS（今回のQuetta build） | DNR `set` | 未確定 | 未確定 | 可 | D/S1で追加 |
| `Sec-CH-UA-Mobile` | DevTools | `?1` | `?0` | changed | CAP-H PASS（今回のQuetta build） | DNR `set` | 有力・未確定 | 未確定 | 可 | B/S1で追加 |
| `Sec-CH-UA-Platform` | DevTools | `"Android"` | `"Windows"` | changed | CAP-H PASS（今回のQuetta build） | DNR `set` | 候補・未確定 | 候補・未確定 | 可 | C/S1で追加 |
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

CAP-Hにより、今回のQuetta実機/buildでは4headerの独立DNR変更が実証された。これは機能上の必要性や他buildでの能力を証明せず、JS/Workerとの整合が必要とも示さない。「候補」は実装決定ではない。

### 段階試験

| ID | 前提 | 今回だけ変えるもの | scope | 目的/次の判断 |
|---|---|---|---|---|
| O-N/O-S | clean baseline | なし/既存Extension ON | 実挙動を観測 | 各5回で値・差分・noise確定 |
| CAP-H | 中立test fixture | 4headerを各1本のruleで単独変更 | localhost `main_frame`のみ | 4項目と最終OFF復帰すべて**PASS** |
| A1 | Native | Success実測UA | `main_frame` | **PASS**。wire/全機能/fresh navigation再現/OFF復帰確認済み |
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

YouTube A/S1はUA-onlyで全項目を満たし、OFFとの差とfresh-navigation再現を確認した。今回の実機/buildではB/C/Dを省略し、UA-onlyを製品MVP第一候補とする。一般site、lifecycle、product UA/version、CWS検証が残るため全体判定は **CONDITIONAL GO**。Worker/high entropyのinvasive patch、service client spoof、excessive permissionが必要ならNO-GO。

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
| HTTP `User-Agent` | A/S1 wire/機能/再現PASS | Tested minimum candidate | 今回の実機/buildではUA-onlyで成立 |
| HTTP low-entropy UA-CH | A/S1でNative維持 | Probably unnecessary | 今回の成立条件では変更不要。将来互換性は未確定 |
| HTTP high-entropy Client Hints | A/S1で観測分はNative維持 | Probably unnecessary | Full-Version-List/Model/Platform-Version変更なしで成立 |

O-N/O-S、CAP-H後にA1 (`User-Agent`, `main_frame`)を実施し、actual wire、全機能、fresh-navigation再現、OFF復帰がPASSしたためAで停止した。B/C/D/S2とJavaScript/Worker変更は今回実行しない。

### HTTP wire記録template

実測値は`HTTP_WIRE_IDENTITY_INVESTIGATION.md`のrun sheetへ記入する。最低行はinitial `main_frame`とsame-origin subresource × `User-Agent`、`Sec-CH-UA`、`Sec-CH-UA-Mobile`、`Sec-CH-UA-Platform`。redirectが実測された場合だけredirect後`main_frame`行を追加する。`missing`（header不在）と`not observed`（request未採取）を区別する。Native/Successでunchangedなheaderはprototype候補から除外する。

### Wire実測後のprototype matrix

CAP-H実機試験ではUA、CH-UA、CH-Mobile、CH-Platformがすべて個別にPASSし、他3headerはNativeを維持した。最終OFF復帰もPASSした。このQuetta実機/buildでは独立A/Bが可能であり、UA-CH変更不能gateは解消した。ただし機能上必要なheaderは未確定である。

4headerすべてがinitial `main_frame`でchangedしたため、値軸は既知成功Chrome 154 fixtureをexperiment profileとして使い、次の順で一つずつ追加する。これはproduct defaultのversion決定ではない。

| 順序 | Header集合 | 理由 |
|---|---|---|
| A | `User-Agent` | legacy server selectionの最小単独候補 |
| B | A + `Sec-CH-UA-Mobile` | desktop/mobileを直接表すが必要性は未証明 |
| C | B + `Sec-CH-UA-Platform` | OS差を追加。必要性は未証明 |
| D | C + `Sec-CH-UA` | brand/version tupleを最後に追加し寄与を分離 |

提示例より`Sec-CH-UA-Mobile`とPlatformをbrandsより先にする。理由は一変数ずつDesktop/mobile・OS軸を分離し、複数brand/GREASE/versionを含むcompoundな`Sec-CH-UA`を最後に置くためであり、必要性の事実認定ではない。browserがUA-CHの不整合状態を拒否する場合だけ、失敗を記録して最小compound testへ移る。

scope軸はA/S1で停止した。A/S1はactual wireと全functional outcomeがPASSし、fresh navigationでも再現した。さらに`www.youtube.com`と`m.youtube.com`の明示的2hostへ同じUA-only `main_frame` ruleを適用すると、既存Mobile tabの通常reloadでも全機能がPASSし、YouTube自身がdesktop URLへ移行した。UA-CHとJavaScript-visible identityはNativeのまま。B/C/D、S2、Extension側URL rewriteは実行しない。

成功条件はnative viewport維持、Desktop Web、Google/YouTube login維持、通常動画、Native Live Chat、基本操作に明白な破綻なし。LiveFlow/NicoFlowは成功条件・依存対象にしない。

## English

### Recording rules and identity matrix

“Requires on-device observation” is unknown and must never be guessed. Label Success UI values as configured and remeasure wire/page/Worker values. Attach run ID, time, versions, context, and top-level origin; never record secrets, cookies, Authorization, or bodies.

The Japanese identity table is normative. DevTools first showed all four Success-baseline wire headers changed, and CAP-H independently changed each one with DNR `set`. A/S1 then passed wire, function, reproduction, and recovery with only UA changed; UA-CH remained Native. UA is therefore sufficient for this tested condition, while portability and future compatibility remain unknown. No reviewed supported Extension API provides an atomic browser-level override for high-entropy or Worker identity, but neither change was needed here.

### Staged tests

CAP-H device testing passed independent modification of UA, CH-UA, CH-Mobile, and CH-Platform while retaining Native values for the other three headers. Final OFF restoration also passed. This resolves the UA-CH modification capability gate for the tested Quetta device/build, but functional necessity remains unknown.

O-N/O-S established controls and CAP-H passed each independent header. A1 then passed actual-wire validation, every functional outcome, fresh-navigation reproduction, and OFF recovery. For this device/build the sequence stops at A with UA-only as the minimum candidate; B/C/D, S2, Window, UAData, and Worker modifications are not run. This does not generalize beyond the tested condition.

### Run sheet, gate, and boundaries

YouTube A/S1 passed with UA-only, including OFF contrast and fresh-navigation reproduction. It is the first product-MVP candidate for this device/build, while overall status remains **CONDITIONAL GO** pending general-site, lifecycle, product-UA/version, and CWS validation. Invasive Worker/high-entropy patching, service spoofing, or excessive permission still means NO-GO.

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
| HTTP `User-Agent` | A/S1 wire/function/reproduction passed | Tested minimum candidate | UA-only succeeded on this device/build |
| HTTP low-entropy UA-CH | Remained Native in A/S1 | Probably unnecessary | No change needed for this success condition; future compatibility unknown |
| HTTP high-entropy Client Hints | Observed fields remained Native in A/S1 | Probably unnecessary | Success without changing Full-Version-List, Model, or Platform-Version |

After O-N/O-S and CAP-H, A1 (`User-Agent` on `main_frame`) passed actual wire, all functions, fresh-navigation reproduction, and OFF recovery, so testing stopped at A. B/C/D/S2 and JavaScript/Worker changes are not run for this condition.

### HTTP wire recording template

Record measurements in the run sheet in `HTTP_WIRE_IDENTITY_INVESTIGATION.md`. Minimum rows are initial `main_frame` and same-origin subresource, each crossed with `User-Agent`, `Sec-CH-UA`, `Sec-CH-UA-Mobile`, and `Sec-CH-UA-Platform`. Add post-redirect `main_frame` rows only when a redirect is observed. Distinguish a missing header from an unobserved request. Exclude headers unchanged between Native and Success from prototype candidates.

### Post-observation prototype matrix

Because all four initial-main-frame headers changed, use the proven Chrome 154 values as an experiment fixture, not a product default. Add one header at a time: A=`User-Agent`; B=A+`Sec-CH-UA-Mobile`; C=B+`Sec-CH-UA-Platform`; D=C+`Sec-CH-UA`. Mobile and platform precede the compound brands/GREASE/version field to isolate simpler desktop/mobile and OS axes; this ordering is a test-design choice, not proof of necessity. Use a labeled compound test only if the browser rejects inconsistent UA-CH states.

The sequence stopped at A/S1 after actual-wire and full functional PASS plus fresh-navigation reproduction. Applying the same UA-only main-frame rule to the explicit `www.youtube.com` and `m.youtube.com` host set also passed an existing-Mobile-tab reload; YouTube itself moved to its desktop URL. UA-CH and JavaScript identity remained Native, so no B/C/D, S2, or extension URL rewrite is needed for this YouTube condition. Do not generalize to other sites.

Success requires retained native viewport, Desktop Web, Google/YouTube login, normal playback, Native Live Chat, and no obvious breakage in basic operation. LiveFlow/NicoFlow are neither success criteria nor dependencies.
