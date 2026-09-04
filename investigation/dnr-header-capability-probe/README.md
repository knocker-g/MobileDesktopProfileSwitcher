# CAP-H DNR Header Capability Probe / CAP-H DNR Header能力調査

## 日本語

### 目的と位置付け

Quetta AndroidのManifest V3 Extensionで、`chrome.declarativeNetRequest`の`modifyHeaders`/`set`が4つのrequest headerを実wire上で変更できるか、各headerを単独で確認する調査専用probeである。MobileDesktopProfileSwitcherの製品コードでもMVPでもない。

対象は`http://localhost:8000/*`への`main_frame`だけ。same-origin subresource、cross-origin、YouTube、外部endpointには適用しない。local serverはこのprobeに含まれず、外部通信や永続logも行わない。

### Tested headersとexperiment fixture

| Mode | Badge | Header | 設定値 |
|---|---|---|---|
| OFF | `OFF` | なし | native |
| CAP-H-UA | `UA` | `User-Agent` | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36` |
| CAP-H-CH-UA | `CH` | `Sec-CH-UA` | `"Not/A)Brand";v="8", "Chromium";v="154", "Google Chrome";v="154"` |
| CAP-H-CH-Mobile | `M0` | `Sec-CH-UA-Mobile` | `?0` |
| CAP-H-CH-Platform | `WIN` | `Sec-CH-UA-Platform` | `"Windows"` |

Chrome 154は再現性のための**experiment fixture**であり、product defaultではない。各modeは1本のsession ruleだけを登録し、他の3headerは変更しない。

### Permission

- `declarativeNetRequestWithHostAccess`: grant済みhostに限定してDNR ruleを使う。
- `host_permissions: ["http://localhost/*"]`: user管理localhostだけを対象にする。Chrome match patternではportを固定せず、DNR `urlFilter`側で`http://localhost:8000/`へ限定する。

`debugger`、`webRequest`、`cookies`、`tabs`、`storage`、content script permissionは要求しない。公式DNR referenceは`set`を一般操作として定義するが、UA-CH headerごとの実効変更は保証していないため、このprobeで実測する。

### Installation on Quetta

1. このdirectoryを端末から参照できる場所へcopyする。folder内容を変更せず、`manifest.json`がrootに見える状態にする。
2. QuettaのExtension管理画面でDeveloper modeを有効にする。
3. `Load unpacked`相当の操作で`investigation/dnr-header-capability-probe/`を選択する。QuettaのUI名称・Android folder picker挙動はbuild差があるため、実機表示に従う。
4. Extension load errorがないことを確認し、toolbarへactionをpinする。
5. PC側のuser管理local serverを`localhost:8000`で用意し、`adb reverse tcp:8000 tcp:8000`で端末のlocalhostへforwardする。CAP-H自身はserverを提供しない。

### Mode切替

初期状態はOFF。toolbar actionを1回押すごとに次の順で切り替わる。

`OFF → CAP-H-UA → CAP-H-CH-UA → CAP-H-CH-Mobile → CAP-H-CH-Platform → OFF`

badgeで現在modeを確認し、**切替後に手動で**`http://localhost:8000/`へaddress barからnavigateする。reloadではなく新しいmain-frame requestを発生させる。ruleが拒否された場合はbadgeが`ERR`になり、Extensionのservice worker consoleにrequested modeとerrorを表示する。errorにはrequest dataを含めない。

各modeは単独試験である。たとえば`CH` modeは`Sec-CH-UA`だけを設定し、`User-Agent`を設定しない。session ruleはbrowser session終了で消える想定だが、試験終了時は明示的にOFFへ戻し、Extensionをdisable/removeする。

### DevTools Network観測

1. XperiaをUSB debuggingでPCへ接続し、PC Chromeの`chrome://inspect/#devices`からQuetta tabをinspectする。
2. Networkをrecording、Preserve log ON、Disable cache ONにする。logをclearする。
3. OFFで`http://localhost:8000/`へnavigateし、最初の`document`の4headerをcontrolとして記録する。
4. actionで対象modeへ進め、logをclearして同じURLへaddress-bar navigationする。
5. Headers > Request Headersで対象headerの実送信値を確認する。`Provisional headers are shown`ならINCONCLUSIVE。
6. 各mode後にOFF controlへ戻すか、少なくとも全cycleの前後でOFFを再確認する。他modeのruleが残っていないことをservice worker consoleのaccepted modeとwire値で確認する。

### 判定表

| Test | Rule受理 | Runtime error | Wire期待値 | Result |
|---|---|---|---|---|
| CAP-H-UA | 受理 | なし | experiment `User-Agent`、他3headerはNative | **PASS** |
| CAP-H-CH-UA | 受理 | なし | experiment `Sec-CH-UA`、他3headerはNative | **PASS** |
| CAP-H-CH-Mobile | 受理 | なし | `?0`、他3headerはNative | **PASS** |
| CAP-H-CH-Platform | 受理 | なし | `"Windows"`、他3headerはNative | **PASS** |
| 最終OFF復帰 | ruleなし | なし | 4headerすべてNativeへ復帰 | **PASS** |

- **PASS**: ruleが受理され、runtime errorがなく、対象`main_frame`の実Request Headersが指定値へ変化。
- **FAIL**: ruleは受理されruntime errorはないが、wire headerが指定値にならない。
- **UNSUPPORTED**: Extension load、rule登録、header変更が明示的に拒否される。
- **INCONCLUSIVE**: provisional header、target/cache/navigation条件、DevTools表示等によりwire判定不能。

rule受理とwire変更を別欄に記録する。badgeだけでPASSにしない。Client Hintsはsecure contextやorigin/browser behaviorに影響され得る。localhostでheaderがnativeから存在しない場合、そのmodeの能力を即FAILとせずrequest条件を記録してINCONCLUSIVEを検討する。

この結果はSony Xperia 1 V上の今回のQuetta Android buildでの実測であり、全Chromium Android browserへの保証ではない。詳細は`../../CAP_H_CAPABILITY_RESULTS.md`を参照する。

### Safety boundary

YouTube内部API、youtubei、`clientName`/`clientVersion`、visitorData、Cookie/Authorization/OAuth、endpoint別spoof、profile rotation、error response連動、proxy/IP、fingerprint randomization、navigator/Worker patchを実装しない。header値を受信・収集・送信・保存せず、DNR ruleはlocalhostの`main_frame`だけに限定する。

## English

### Purpose and status

This investigation-only Manifest V3 extension independently tests whether Quetta Android can apply `chrome.declarativeNetRequest` `modifyHeaders`/`set` to four wire request headers. It is neither MobileDesktopProfileSwitcher product code nor its MVP.

It targets only `main_frame` requests to `http://localhost:8000/*`. It does not affect same-origin subresources, cross-origin requests, YouTube, or external endpoints. It includes no server, external communication, or persistent logging.

### Headers and experiment fixture

The modes and exact values are identical to the Japanese table: OFF, CAP-H-UA (`UA` badge), CAP-H-CH-UA (`CH`), CAP-H-CH-Mobile (`M0`), and CAP-H-CH-Platform (`WIN`). Chrome 154 is an **experiment fixture**, not a product default. Exactly one session rule and one header are active at a time.

### Permissions

`declarativeNetRequestWithHostAccess` enables DNR only on granted hosts, and `host_permissions: ["http://localhost/*"]` limits access to user-controlled localhost. The Chrome match pattern does not pin a port; the DNR `urlFilter` narrows actual rules to `http://localhost:8000/`. The extension requests no `debugger`, `webRequest`, `cookies`, `tabs`, `storage`, or content-script permission. The official reference defines `set` generally but does not guarantee effective modification for each UA-CH name; this probe measures that gap.

### Installation on Quetta

Copy this directory to a device-accessible location with `manifest.json` at its root. Enable Developer mode in Quetta’s extension manager and use its Load unpacked equivalent to select the directory; exact UI/folder-picker behavior may vary by build. Confirm no load error and pin the action. Run a user-controlled PC local server on port 8000 and use `adb reverse tcp:8000 tcp:8000`. CAP-H does not provide the server.

### Switching modes

Each toolbar-action click cycles `OFF → CAP-H-UA → CAP-H-CH-UA → CAP-H-CH-Mobile → CAP-H-CH-Platform → OFF`. After switching, manually navigate from the address bar to `http://localhost:8000/`. An `ERR` badge means rejection; inspect the extension service-worker console for the requested mode and error. No request data is logged. Each mode changes only its named header. Return to OFF and disable/remove the probe after testing.

### DevTools observation

Connect the Xperia using USB debugging, inspect the Quetta tab from desktop Chrome `chrome://inspect/#devices`, enable Network recording, Preserve log, and Disable cache, and clear the log. Capture an OFF control, select one mode, clear again, and navigate from the address bar. Inspect the first document’s actual Request Headers. Treat provisional headers as INCONCLUSIVE. Recheck OFF before/after the cycle and verify that no prior mode remains.

### Classification

The Japanese results table is normative. All four CAP-H modes **PASS**: each rule was accepted without a runtime error, changed only its selected wire header, and left the other three at Native values. The final return to OFF also **PASS**ed and restored all four Native values. **FAIL** means accepted without runtime error but the wire value differs. **UNSUPPORTED** means explicit load/registration/header-modification rejection. **INCONCLUSIVE** means request, cache, provisional-header, or DevTools conditions prevent a wire decision. Never classify PASS from the badge alone. These results apply only to the tested Quetta Android device/build, not all Chromium Android browsers. See `../../CAP_H_CAPABILITY_RESULTS.md` for the full record.

### Safety boundary

Do not implement YouTube internals, youtubei, `clientName`/`clientVersion`, visitorData, cookie/auth/OAuth changes, endpoint spoofing, rotation, response-triggered behavior, proxy/IP changes, fingerprint randomization, or navigator/Worker patching. Do not receive, collect, transmit, or store header values. Rules are restricted to localhost main-frame requests.
