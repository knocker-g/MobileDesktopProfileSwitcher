# HTTP Wire Identity Investigation / HTTP Wire Identity調査

## 日本語

### 1. 目的と範囲

Sony Xperia 1 V + Quetta Androidから実際に送信されたrequest headerをNative/Successで比較し、成功profileが変える最小HTTP identity候補を実測する。必須対象は`User-Agent`、`Sec-CH-UA`、`Sec-CH-UA-Mobile`、`Sec-CH-UA-Platform`のみ。追加Client Hintsは、この4項目と機能結果だけでは説明できず、実際のresponseに`Accept-CH`等がある場合に限り次段へ追加する。

request種別はinitial top-level navigation、存在する場合のredirect後top-level navigation、same-origin subresourceを分離する。cross-originとservice-specific internal APIは初期範囲外。JavaScript側とwire側の完全一致を要件にしない。

### 2. 観測方式の比較と選定

| 方法 | 長所 | 制約・risk | 判定 |
|---|---|---|---|
| Chromium DevTools Network | browserが認識する実送信request headerをtab単位で確認でき、server実装・TLS interception不要 | Quettaがremote-debug targetを公開するか未確認。HARはCookie/Authを含み得る | **第一選択、Quettaは要実機確認** |
| Chrome remote debugging | DevTools NetworkをAndroid tabへ接続する標準経路 | Chrome for Androidの公式対応はあるがQuetta固有対応は確認できない | DevTools feasibility手段 |
| user管理local echo | initial/redirect/subresourceを制御し、受信headerを直接確認可能 | 小さなserverが必要。HTTP/localhostでUA-CHが送られるかも実測対象。恒久log禁止 | **fallback、今回は設計のみ** |
| MITM/TLS interception/third-party inspector | 任意trafficを見られる | credential/privacy risk、禁止事項に該当 | 不採用 |

採用手順は、まずremote DevTools feasibility checkを行い、Quetta tabをinspectできればDevTools Networkを使う。できなければ「remote debugging unavailable on tested Quetta build」と記録し、local echoを別taskで最小実装する。現時点では`investigation/http-header-probe/`を作らない。

### 3. Quetta remote debugging feasibility

Quettaで可能とは未確認であり、次を実機で判定する。

1. PCへAndroid SDK Platform ToolsとChrome/Chromiumを用意する（project dependencyにはしない）。
2. XperiaでDeveloper optionsを有効にし、USB debuggingをONにする。
3. data通信可能なUSB cableで接続し、端末のRSA fingerprintを確認してこのPCを許可する。調査後は許可取消を検討する。
4. PCで`adb devices`を実行し、deviceが`device`状態であることを確認する。`unauthorized`なら端末promptを再確認する。
5. Quettaで中立test pageを開く。PC Chrome/Chromiumで`chrome://inspect/#devices`を開き、Discover USB devicesを有効にする。
6. Xperia配下にQuettaの対象tabが表示され、`inspect`でDevToolsが開くか確認する。

表示されれば「Quetta remote debugging: observed supported（tested build/versionを記録）」とする。端末は見えるがQuetta tabが出ない場合、Chromeの一般手順を根拠にQuetta対応と断定せずfallbackへ進む。debug socketを推測してADB forwardする非標準手順は採用しない。

### 4. DevTools Network採取手順

1. Native条件を固定し、対象tabをinspectする。Network panelを開き、recordingをON、**Preserve logをON**、**Disable cacheをON**にする。Preserve logはinitial requestとredirect chain保持に必要。Disable cacheはsame-origin subresourceを毎run発生させるため必要。
2. Network logをclearし、Quettaのaddress barから中立test URLへ新規navigationする。DevToolsを開く前のrequestは採れないため、inspect済みtabからnavigationする。
3.最初の`document` requestを選び、Headers > Request Headersで4headerを転記する。`Provisional headers are shown`の場合は確定値と扱わずrunを再取得する。
4. redirectがあればStatus/Initiator/Locationでchainを確認し、redirect後の各`document`を別rowにする。
5. test pageが同一originから読み込む固定subresourceを1件選び、同じ4headerを転記する。cache表示なら再取得する。
6. HAR全体は原則exportしない。必要ならDevToolsのsanitized HARを使い、それでも保存前に`Cookie`、`Set-Cookie`、`Authorization`、query、bodyを確認・除外する。推奨は4headerだけの手動転記。
7. Success条件へ切り替え、同じURL、tab手順、network、orientation、viewportで繰り返す。Native/Successを交互に各5run行う。

YouTube機能確認は別tab/runで行い、account付きYouTube HARを保存しない。必要なら対象requestの4headerだけを手動転記し、internal API payloadは開かない。

### 5. Local echo fallback要件

remote debugging不可の場合のみ、後続taskで`investigation/http-header-probe/`を検討する。PC loopbackだけでlistenし、ADBの`adb reverse tcp:<device-port> tcp:<host-port>`によりQuettaから`http://localhost:<device-port>`へ接続する。endpointは(1)headerをHTMLで一度表示するinitial page、(2)同一originの固定subresource、(3)任意のsingle redirectを提供する。対象4headerだけをallowlist表示し、Cookie/Auth/query/bodyを読取・表示・logせず、memory/consoleにも恒久保存しない。外部bind、telemetry、dependency、TLS interceptionは不可。

localhost HTTPで各UA-CHが存在するかは推測せず、`missing`として実測する。headerがないことがtransport/test-origin条件による可能性を分離できない場合は、user管理HTTPS originが必要かを次のgateで判断する。

### 6. Run sheet

環境欄: run ID、baseline、日時、Android/Quetta/User-Agent Switcher and Manager version、profile名、PC DevTools version、method、URL origin、viewport/orientation、cache設定。秘密を含む完全URLは保存しない。

| Request | Header | Native | Success | Changed |
|---|---|---|---|---|
| initial `main_frame` | `User-Agent` | 未観測 | 未観測 | 未確定 |
| initial `main_frame` | `Sec-CH-UA` | 未観測 | 未観測 | 未確定 |
| initial `main_frame` | `Sec-CH-UA-Mobile` | 未観測 | 未観測 | 未確定 |
| initial `main_frame` | `Sec-CH-UA-Platform` | 未観測 | 未観測 | 未確定 |
| same-origin subresource | `User-Agent` | 未観測 | 未観測 | 未確定 |
| same-origin subresource | `Sec-CH-UA` | 未観測 | 未観測 | 未確定 |
| same-origin subresource | `Sec-CH-UA-Mobile` | 未観測 | 未観測 | 未確定 |
| same-origin subresource | `Sec-CH-UA-Platform` | 未観測 | 未観測 | 未確定 |

redirectが存在したrunだけ、`redirected main_frame`の4行を追加する。値が送られなければ`missing`、request自体を採取できなければ`not observed`、DevToolsがprovisionalなら`inconclusive`と書く。5runの完全一致/変動もheaderごとに記録する。

### 7. 次のA/B prototypeへの接続

wire実測前の固定順序は作らない。実測後は次のalgorithmで候補化する。

1. Native/Successでchangedなheaderだけを残す。unchanged/missingなheaderは追加しない。
2. `User-Agent`がchangedなら最初のvalue-axis test Aとする。changedでなければ、changed headerのうちlow-entropyで最小の1項目から始める。
3. 残るchanged headerを一つずつ追加し、各段階で直前要素のablationを行う。UA-CH tupleがbrowserに拒否される場合だけcompound testと明記する。
4. scope-axisは別系列にし、`main_frame`のみを先に試す。失敗時だけsame-originへ広げる。valueとscopeを同じrunで同時変更しない。
5. JavaScript/Worker patchは初期prototypeに入れない。HTTPだけでSuccessを再現できない新証拠が出た場合に再評価する。

### 8. Safetyと停止位置

Cookie、Authorization/OAuth、body、youtubei payload、`clientName`/`clientVersion`、visitorData、service-specific spoof、endpoint別identity、proxy/IP、randomization、HTTP error起点切替を観測・保存・変更対象にしない。本成果物は採取手順の確定まで。manifest、DNR、navigator patch、server、dependencyは実装しない。

### 9. 根拠

- [Chrome DevTools: Remote debug Android devices](https://developer.chrome.com/docs/devtools/remote-debugging)
- [Chrome DevTools: Network features reference](https://developer.chrome.com/docs/devtools/network/reference)
- [Android Developers: ADB reverse to a local server](https://developer.android.com/develop/ui/views/layout/webapps/access-local-server)

### 10. 実測完了（2026-09-04）

Xperia 1 V上のQuetta tabは`chrome://inspect/#devices`へremote debugging targetとして実際に公開され、DevTools Networkで観測できた。これは当該実機/buildのObserved factであり、全Quetta versionへの保証ではない。Preserve log/Disable cacheをON、PC版サイトOFF、native viewport維持で採取した。

| Request | Header | Native | Success | Changed |
|---|---|---|---|---|
| initial `main_frame` | `User-Agent` | Android 10 / Chrome 148 / Mobile | Windows 10 x64 / Chrome 154 / non-Mobile | yes |
| initial `main_frame` | `Sec-CH-UA` | Chromium 148, Quetta 148, Not/A)Brand 99 | Not/A)Brand 8, Chromium 154, Google Chrome 154 | yes |
| initial `main_frame` | `Sec-CH-UA-Mobile` | `?1` | `?0` | yes |
| initial `main_frame` | `Sec-CH-UA-Platform` | `"Android"` | `"Windows"` | yes |
| same-origin JavaScript | `User-Agent` | 未観測 | Windows 10 x64 / Chrome 154 / non-Mobile | Native比較未完了 |
| same-origin JavaScript | `Sec-CH-UA` | 未観測 | Success `main_frame`と一致 | Native比較未完了 |
| same-origin JavaScript | `Sec-CH-UA-Mobile` | 未観測 | `?0`、Success `main_frame`と一致 | Native比較未完了 |
| same-origin JavaScript | `Sec-CH-UA-Platform` | 未観測 | `"Windows"`、Success `main_frame`と一致 | Native比較未完了 |

initial `main_frame`では4headerすべてがNative→Successでchanged。Successの`main_frame`とsame-origin JavaScriptでは4headerが完全一致した。ただしNative same-origin値は今回提示されていないため、そのrequest種別のNative→Success差分を直接Observedとはしない。redirectは存在/値の報告がなくUnknown。

同時に既存ProbeではPage/Worker JavaScript identityがNative値のままunchangedだった。Observedな成功状態はwire=Desktop Chrome/Windows、JavaScript=Quetta/Android/mobileである。この不一致で既知caseは成功したが、JavaScript patchが一般に不要とは証明しない。

## English

### 1. Objective and scope

Directly compare request headers sent by Sony Xperia 1 V + Quetta Android in Native and Success conditions. Initially observe only `User-Agent`, `Sec-CH-UA`, `Sec-CH-UA-Mobile`, and `Sec-CH-UA-Platform`. Expand to additional Client Hints only when these four plus functional outcomes are insufficient and an actual response opts in, for example with `Accept-CH`.

Separate initial top-level navigation, post-redirect top-level navigation when present, and same-origin subresources. Cross-origin and service-specific internal APIs are initially out of scope. Do not require JavaScript and wire identity to match.

### 2. Method selection

Prefer Chromium DevTools Network because it observes browser-sent request headers per tab without a server or TLS interception. Chrome for Android officially supports USB remote debugging, but Quetta-specific support is unverified. Therefore first run a feasibility check. If Quetta exposes the tab, use DevTools. If not, record it as unavailable on the tested build and use a user-controlled local echo through ADB reverse in a later task. Do not create `investigation/http-header-probe/` yet. MITM, TLS interception, and third-party inspectors are rejected.

### 3. Quetta feasibility procedure

Install Android SDK Platform Tools and desktop Chrome/Chromium outside the project. Enable Android Developer options and USB debugging, connect with a data-capable cable, verify and accept the PC RSA fingerprint, and confirm `adb devices` reports `device`. Open a neutral page in Quetta, visit `chrome://inspect/#devices` on desktop, enable Discover USB devices, and check whether the Xperia and Quetta tab appear and `inspect` opens DevTools. Only an observed tab is evidence of Quetta support. Do not guess a debug socket or use nonstandard forwarding.

### 4. DevTools capture

Inspect the tab, open Network, enable recording, **Preserve log**, and **Disable cache**. Preserve log retains initial navigation and redirects; disabling cache forces subresource requests. Clear the log, then navigate from the inspected tab’s address bar. For the first `document`, manually transcribe the four Request Headers. Treat “Provisional headers are shown” as inconclusive. Record each redirected document separately. Select one fixed same-origin non-cached subresource and record the same four headers.

Avoid HAR export. If unavoidable, use sanitized export and review/remove Cookie, Set-Cookie, Authorization, query data, and bodies. Manual transcription of four headers is preferred. Alternate five Native and five Success runs with the same URL, network, orientation, and viewport. Validate YouTube functionality separately and never save an authenticated YouTube HAR or inspect internal payloads.

### 5. Local echo fallback

Only if remote debugging fails, consider a later minimal local-only tool. Bind on PC loopback and use `adb reverse tcp:<device-port> tcp:<host-port>`, opening `http://localhost:<device-port>` in Quetta. Provide one header-display page, one fixed same-origin subresource, and one optional single redirect. Allowlist-display only the four target headers; never read/display/log Cookie, auth, query, or body. No external bind, telemetry, dependencies, persistent logs, or TLS interception. Treat UA-CH presence on localhost as measured, not assumed; use `missing`, and escalate to a user-controlled HTTPS-origin decision only if origin/transport remains confounded.

### 6. Recording

Record run ID, baseline, time, relevant versions/profile, DevTools version, method, origin, viewport/orientation, and cache settings without secret-bearing full URLs. Use the exact eight-row table in the Japanese section for initial `main_frame` and same-origin subresource crossed with the four headers. Add four redirected-main-frame rows only when observed. Distinguish `missing`, `not observed`, and `inconclusive`, and record five-run stability per header.

### 7. Prototype derivation

After wire measurement, retain only changed headers. If UA changed, test it first; otherwise begin with the smallest changed low-entropy field. Add one remaining changed header at a time with ablation; use a labeled compound tuple only if the browser rejects intermediate UA-CH states. Test scope separately: main frame first, then same-origin only after failure. Never change value and scope together. Keep JavaScript/Worker patching out unless new evidence shows HTTP-only reproduction fails.

### 8. Safety and stopping point

The prohibited data and techniques exactly match the Japanese section. This phase stops with a capture procedure. Do not implement a manifest, DNR, navigator patch, server, or dependency.

### 9. Sources

The three primary-source links above apply identically.

### 10. Completed observation (2026-09-04)

The Quetta tab on the tested Xperia 1 V was observed as a remote-debugging target in `chrome://inspect/#devices`, and DevTools Network worked. This is evidence for the tested device/build, not all Quetta versions. With Preserve log and Disable cache enabled, Desktop Site off, and the native viewport retained, all four initial-main-frame headers changed: UA from Android/Chrome 148/Mobile to Windows x64/Chrome 154/non-Mobile; brands from Chromium/Quetta 148 plus Not/A)Brand 99 to Chromium/Google Chrome 154 plus Not/A)Brand 8; mobile from `?1` to `?0`; platform from Android to Windows.

All four Success same-origin JavaScript-request values matched the Success main frame. Native same-origin values were not supplied, so a direct Native→Success classification for that request type remains incomplete. Redirect presence/values are Unknown. Existing Probe evidence simultaneously shows unchanged native Quetta/Android Page and Worker identity. Thus wire/Desktop and JavaScript/native identity coexist in the observed successful case, without proving JavaScript patching universally unnecessary.
