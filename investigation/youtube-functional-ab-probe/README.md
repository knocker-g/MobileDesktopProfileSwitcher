# YouTube Functional A/B Test Runner / YouTube機能A/B自動試験runner

## 日本語

### 目的と位置付け

Xperia 1 V + Quetta Androidで、Android native narrow viewportを維持したままYouTube Desktop WebとNative Live Chatに必要な最小wire identity header集合、および`main_frame`だけで十分かを調べる調査専用Manifest V3 Extensionである。MobileDesktopProfileSwitcherの製品コードやMVPではない。

toolbar actionからrunner UIを開き、`OFF → A → B → C → D → OFF recovery`を自動実行する。各stepはDNR modeを切り替えた後、runnerが作成したfresh tabで新しいtop-level navigationを行い、load後にDOM diagnosticを収集してtabを閉じる。Cookie、site data、login stateは削除しない。ユーザーが既に開いていたtabは閉じない。

### A〜D/S1とfixture

A/S1とMobile modeは`https://www.youtube.com/*`と`https://m.youtube.com/*`の明示的2hostの`main_frame`を対象にする。B/C/Dのscopeは従来どおり`https://www.youtube.com/*`の`main_frame`のみ。1本のsession ruleに現在modeのheader集合だけを設定する。

| Mode | Badge | Request headers |
|---|---|---|
| OFF | `OFF` | なし |
| A/S1 | `A` | `User-Agent` |
| B/S1 | `B` | A + `Sec-CH-UA-Mobile` |
| C/S1 | `C` | B + `Sec-CH-UA-Platform` |
| D/S1 | `D` | C + `Sec-CH-UA` |
| Mobile | `MOB` | Mobile `User-Agent`のみ |

| Header | Experiment fixture |
|---|---|
| `User-Agent` | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36` |
| `Sec-CH-UA` | `"Not/A)Brand";v="8", "Chromium";v="154", "Google Chrome";v="154"` |
| `Sec-CH-UA-Mobile` | `?0` |
| `Sec-CH-UA-Platform` | `"Windows"` |
| Mobile `User-Agent` | `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36` |

Chrome 154は既知Success baselineを再現する**experiment fixture**であり、product defaultではない。Page/Worker JavaScript identity、subframe、script、stylesheet、image、XHR/fetch、WebSocket、その他subresourceは変更しない。

### Permissionと実装境界

- API permission: `declarativeNetRequestWithHostAccess`のみ。
- Host permission: `https://www.youtube.com/*`と`https://m.youtube.com/*`の明示的2hostのみ。
- `content-diagnostics.js`: `document_idle`で`www.youtube.com`または`m.youtube.com`のtop frameへ静的に読み込み、要求時だけDOMのboolean evidenceとviewport値を返す。Native OFF時にMobile Webへ遷移した最終documentも診断するための限定追加であり、DNR対象は拡張しない。
- runnerはTabs APIで自分の試験tabをcreate、load監視、message送信、removeするが、機密なtab metadataを取得しないため`tabs` permissionは追加しない。

`debugger`、`webRequest`、`cookies`、`tabs`、`scripting`、`storage` permissionは要求しない。DNR用`host_permissions`は`www.youtube.com`と`m.youtube.com`だけで、wildcard subdomain、`google.com`、`googlevideo.com`、`ytimg.com`等を許可しない。AとMobileだけが両hostへそれぞれのUAを設定し、B/C/Dは`www`限定のまま。actual Request HeadersをExtensionから取得しない。

### Installation on Quetta

1. このdirectoryを端末から参照できる場所へcopyし、`manifest.json`がfolder rootにある状態にする。
2. QuettaのExtension管理画面でDeveloper modeを有効にし、`Load unpacked`相当からfolderを選ぶ。
3. load errorがないことを確認してactionをtoolbarへpinする。
4. User-Agent Switcher and Manager、CAP-H等、他のidentity変更ExtensionをOFFにする。
5. actionを押す。新しいExtension内tabとしてrunner UIが開く。

### Run All TestsとLive URL

1. Live Chatを確認する場合だけ、ユーザーが選んだHTTPSの`www.youtube.com`、`m.youtube.com`、または`youtu.be` URLを入力する。固定の第三者URLは埋め込まれていない。Run Allは既存仕様どおり`m.youtube.com`と`youtu.be`を`www.youtube.com`へ正規化する。今回の既存Mobile tab reload検証はManual Aで行い、Run All仕様は変更しない。
2. URL未入力時はhomepageを使い、V/D/Lを収集する。Cは`NOT_TESTED`になる。
3. `Run All Tests`を押す。入力URLはrunner tabのmemoryとnavigationにだけ使われ、result JSONやservice worker consoleへ完全URL・query・video IDを保存しない。
4. runnerは各modeをactivateし、fresh active tabを作成し、top-level load完了後8秒のDOM settle時間を置いてdiagnosticを収集し、そのtabだけをcloseする。
5. 60秒以内にloadしないstepやcontent scriptから応答がないstepはerrorとして記録し、次stepへ進む。
6. 最後にOFF recoveryを同じ方法で測定する。例外終了時もOFF復帰を試みる。

試験中は作成されたYouTube tabが順に前面へ出る。自動再生、動画操作、chat投稿は行わない。既存tabやCookie/login stateは変更しない。

### Manual Mode

runner UIの`OFF`、`A`、`B`、`C`、`D`、`Mobile`ボタンから共通のmode定義・session rule更新処理を手動実行できる。選択時は旧ruleを削除し、選択modeのruleだけを登録して`getSessionRules()`で検証する。成功時は`Current mode`とtoolbar badgeが更新される。Mobileは`Current mode: MOBILE`、badge `MOB`で識別する。失敗時はruleを削除してbadgeとUIを`ERR`にする。

Manual ModeはDNR modeを固定するだけで、tab作成、navigation、診断、closeを行わない。Run All開始中は競合防止のためmanual buttonsを無効化し、Run Allはmanual状態に関係なくOFFから開始して最後にOFFへ復帰する。

既存`m.youtube.com` tabのreload検証では、Native Mobile状態で`m.youtube.com/watch?...`を開いたtabを保持し、Manual Aを選択して`Current mode: A`を確認してから、その同じtabを通常reloadする。ExtensionはURL rewrite、redirect、navigationを行わない。reload後にDesktop Web、native viewport、動画、Live Chat、chat入力を目視し、PC DevToolsのmain document Request Headersで`User-Agent`だけがfixtureへ変わりUA-CHがNativeのままかを確認する。終了後はManual OFFへ戻す。

A/S1を目視確認する例:

1. runnerを開く。
2. Manual Modeで`A`を選ぶ。
3. `Current mode: A`を確認する。
4. Quettaでfresh tabを開く。
5. YouTube Live URLを開く。
6. 動画の実再生を確認する。
7. Native Live Chat本文を確認する。
8. chat入力欄を確認する。
9. old-browser warningがないことを確認する。
10. 終了後、runnerのManual Modeを`OFF`へ戻し、次のfresh navigationがNative headerへ復帰することを確認する。

### Mobile UA-only mode（実測済み）

PC Chromiumの通常Desktop viewportを維持し、`www.youtube.com`または`m.youtube.com`の`main_frame`だけへQuetta Native baseline由来のMobile Chrome/Android UA fixtureを設定する。UA-CH、JavaScript-visible identity、viewport、subresourceは変更しない。このfixtureは製品Mobile Profileの固定値ではない。

1. PC Chromiumでこのdirectoryをunpacked Extensionとして読み込む。
2. DevTools device emulationを使わず、通常Desktop viewportの既存`www.youtube.com/watch?...` tabを保持する。
3. runnerを開き、Manual Modeで`Mobile`を選んで`Current mode: MOBILE`とbadge `MOB`を確認する。
4. 同じYouTube tabを通常reloadする。ExtensionはURL rewrite、host変換、navigation、redirectを行わない。
5. Mobile Webへの移行、viewport維持、動画再生、Live Chat、chat入力、old-browser warning、最終hostを目視記録する。
6. 必要な場合だけDevToolsでmain documentの`User-Agent`がMobile fixtureで、UA-CHがPC Nativeのままかを確認する。
7. 終了後Manual Modeを`OFF`へ戻してreloadする。

Run Allのsequenceは`OFF → A → B → C → D → OFF recovery`のままで、Mobileを含めない。

実測では通常PC viewportの既存`www.youtube.com` tabをreloadするとMobile Web、viewport維持、動画再生がPASSし、old-browser warningはなかった。YouTube自身が`m.youtube.com`へ移行し、ExtensionによるURL変換はなかった。DevToolsで`m.youtube.com` main documentのUAがfixtureへ変更されたことも確認した。Native Live Chatとchat入力はMobile Web設計上非表示であり、`EXPECTED: NOT AVAILABLE BY MOBILE WEB DESIGN`としてMobile ProfileのFAILにはしない。この結果はPC Chrome上のYouTube固有であり、他siteや全Chromiumへ一般化しない。

### 自動収集

- **V — Viewport材料**: `innerWidth`、`innerHeight`、`devicePixelRatio`、`screen.width`、`screen.height`。portrait関係だけを使う`nativeNarrowViewportHeuristic`も出すが、Xperia 1 V実験用でproduct thresholdではない。
- **D — Desktop Web**: `ytd-app`、desktop page component、`ytd-masthead`と、`ytm-app`、mobile topbarの複数boolean signalを記録する。desktop signalが2個以上かつmobile signalなしの場合だけ`true`、逆方向の明確な場合だけ`false`、それ以外は`UNKNOWN`。
- **L — Login UI**: avatar/account buttonとSign in controlの存在だけを記録し、`true`、`false`、`UNKNOWN`へ分類する。名前、画像URL、account identifier、Cookie/tokenは取得しない。
- **C — Native Live Chat**: chat component、iframe、load状態、既知のold-browser warningをbooleanで記録する。warning検出時は`false`、構造があってwarningなしでも実利用は保証できないため`MANUAL_CHECK_REQUIRED`。URL未入力は`NOT_TESTED`。
- **B — Basic operation材料**: `<video>`に加え、error候補componentの存在、実可視性、active player error state、可視error文言signalを別々に記録する。非表示componentの存在だけではerrorにしない。active state、または可視componentとerror文言の組合せだけを確定errorとし、可視だが裏付け不足なら`MANUAL_CHECK_REQUIRED`を優先する。動画の実再生は自動化しない。

DOM文言は既知warningのboolean検出にだけ使い、page本文をresultへ保存しない。単一selectorだけでDesktop/Login/Chatを断定しない。

### Manual確認が残る項目

Native Live Chatの表示・実利用、動画の実再生、基本navigation、visualなnative viewport維持は人間が最終確認する。自動結果の`true`は限定されたDOM heuristicの成立であり、V+D+L+C+Bのfunctional PASSを自動確定しない。`UNKNOWN`、`NOT_TESTED`、`MANUAL_CHECK_REQUIRED`を維持して過剰判定を避ける。

LiveFlow/NicoFlowは依存先・統合対象・PASS条件ではない。必要ならresult外のoptional compatibility noteとして観察する。

### Rule configurationとWire verification

各stepは`getSessionRules()`の結果からmode、rule ID（OFFは`null`）、`resourceTypes`、設定された`requestHeaders`のheader、operation、fixture valueを`ruleConfiguration`へ記録する。

これはExtensionが保持する**Rule configuration**であり、実送信されたheaderの証拠ではない。`wireVerification`は常に`NOT_CAPTURED`で、rule受理だけからWire VALIDやfunctional因果を判断しない。actual wire verificationは別のPC-side CDP/DevTools手順で行う。`debugger`、`webRequest`、broad host permissionは追加しない。

### Result JSONとcopy

進捗中もUIへJSONを表示し、完了時に同じ結果をservice worker consoleへ出す。`Copy Result JSON`でclipboardへcopyできる。

```json
{
  "schemaVersion": 1,
  "timestamp": "2026-09-05T00:00:00.000Z",
  "environment": {
    "target": "YouTube",
    "targetPage": "user-supplied-live-page",
    "fixture": "Chrome 154 experiment fixture",
    "scope": "https://www.youtube.com/* main_frame only",
    "actualWireHeadersCaptured": false
  },
  "results": {
    "OFF": {
      "mode": "OFF",
      "ruleConfiguration": {
        "mode": "OFF",
        "ruleId": null,
        "resourceTypes": [],
        "requestHeaders": []
      },
      "wireVerification": "NOT_CAPTURED",
      "viewport": {},
      "desktopWeb": { "value": "UNKNOWN", "evidence": {} },
      "login": { "value": "UNKNOWN", "evidence": {} },
      "liveChat": { "value": "MANUAL_CHECK_REQUIRED", "evidence": {} },
      "oldBrowserWarning": false,
      "basicOperation": { "value": "MANUAL_CHECK_REQUIRED", "evidence": {} },
      "automationError": null
    },
    "A": {},
    "B": {},
    "C": {},
    "D": {}
  },
  "offRecovery": {}
}
```

timestampは単純な試験開始時刻だけ。完全URL、query、video ID、title、account情報、Cookie/Auth、page textは保存しない。

### 実機Observed result

初回runではOFF/OFF recoveryの`m.youtube.com` documentにreceiverがなく接続失敗し、hidden error componentをplayability errorと誤検出した。両方をdiagnostics側で修正し、DNR ruleは変更していない。

修正後Run AllではA/B/C/Dすべてでnative narrow viewport heuristic、Desktop Web、login、Live Chat component/frame/frameLoadedが`true`、old-browser warningとconfirmed playability errorが`false`だった。OFF/OFF recoveryもautomation errorなくNative narrow viewportとMobile Webを診断し、最終復帰した。

A/S1は別途DevToolsでactual wireを確認し、UAだけがWindows Chrome 154 fixture、low/high-entropy UA-CHはNative Quetta/Android/Mobileのままだった。手動でDesktop Web、native viewport、login、動画再生、Native Live Chat、chat入力、warningなしがPASSし、fresh navigationで再現、final OFF recoveryもPASSした。この実機/buildではAでincremental試験を停止する。詳細は`../../YOUTUBE_FUNCTIONAL_AB_RESULTS.md`を参照する。

既存`m.youtube.com` Mobile tabへManual Aを適用して通常reloadした実機試験では、`m.youtube.com` main documentのUAがfixtureへ変わり、Desktop Web、native viewport、動画再生、Native Live Chat、chat入力がすべてPASSした。YouTube自身が最終的に`www.youtube.com` desktop URLへ移行し、ExtensionによるURL rewrite、navigation、redirectは不要だった。これは今回のYouTube/実機buildに限定し、全Chromiumや他siteへ一般化せず、Chrome 154をproduct defaultともしない。

### Known limitations

- DOM構造はYouTube更新、localization、experimentで変化し、heuristicが`UNKNOWN`になることがある。
- iframeの存在はLive Chatが実際に利用可能であることを保証しない。
- load完了と8秒待機は全dynamic contentの完了を保証しない。
- runner tabがbackgroundになった際のAndroid側timer/throttlingやQuetta lifecycleの影響を受け得る。
- A/Mobileは`www.youtube.com`と`m.youtube.com`だけ、B/C/Dは`www.youtube.com`だけが対象であり、それ以外へのredirectは変更しない。
- subresourceはNative identityのまま。S1全敗または明確な部分成功後にのみ別設計のS2を検討する。
- wire capture、ablation、再現性判定、最終functional PASSは自動化していない。

### Safety boundary

youtubei payload、`clientName`/`clientVersion`、visitorData、Cookie/Authorization/OAuth、Native Live Chat API、endpoint別spoof、response code連動変更、proxy/IP変更、fingerprint randomization、navigator/Worker patchを実装・取得・変更しない。telemetry、analytics、外部test endpoint、永続storage、request/page内容の保存を行わない。

## English

### Purpose and execution

This investigation-only Manifest V3 extension automates the A–D/S1 sequence on Xperia 1 V + Quetta Android. It is not MobileDesktopProfileSwitcher product code or its MVP. The runner opens from the toolbar action and executes `OFF → A → B → C → D → OFF recovery`. After activating each DNR mode, it creates a fresh top-level YouTube tab, waits for load plus an eight-second DOM-settle interval, collects non-invasive diagnostics, and closes only that runner-created tab. It never clears cookies, site data, or login state.

A/S1 and Mobile mode target `main_frame` requests on exactly `https://www.youtube.com/*` and `https://m.youtube.com/*`. B/C/D retain their previous `www.youtube.com`-only scope. OFF sets nothing; A sets Desktop UA; B–D retain their existing cumulative definitions; Mobile sets only the Quetta Native baseline Mobile UA. Desktop Chrome 154 and Mobile Chrome/Android 148 values are experiment fixtures, not product defaults. Page/Worker JavaScript identity, viewport, and subresources remain unchanged.

### Permissions and installation

The only API permission is `declarativeNetRequestWithHostAccess`. Host permissions list exactly `https://www.youtube.com/*` and `https://m.youtube.com/*`; no wildcard subdomain or related Google/YouTube domain is included. A and Mobile apply their respective UA-only rules to both hosts, while B/C/D remain `www`-only. The runner does not request `tabs`, `scripting`, `debugger`, `webRequest`, `cookies`, or `storage` permission.

Copy the directory to device-accessible storage, enable Developer mode in Quetta, load it unpacked, verify there is no load error, pin its action, and disable every other identity-changing extension. Press the action to open the runner UI.

### Run All Tests and Live URL

Optionally enter a user-chosen HTTPS URL on `www.youtube.com`, `m.youtube.com`, or `youtu.be` for a live stream, then press `Run All Tests`. Run All retains its existing behavior and canonicalizes mobile and short URLs to `www.youtube.com`. The new existing-Mobile-tab reload test is manual only. No third-party live URL is embedded, and results omit the full URL, query, and video ID.

### Manual Mode

The runner UI provides OFF/A/B/C/D/Mobile buttons backed by one mode-definition and session-rule update path. A selection removes the previous rule, registers only the selected mode, verifies it with `getSessionRules()`, and updates both `Current mode` and the toolbar badge. Mobile appears as `Current mode: MOBILE` with badge `MOB`. Failure clears the rule and displays `ERR`.

Manual Mode only fixes the DNR mode; it does not create, navigate, diagnose, or close any tab. Its buttons are disabled while Run All is active. Run All ignores the prior manual state, starts with OFF, executes the unchanged sequence, and restores OFF at completion.

To test an existing Mobile tab, first keep a Native `m.youtube.com/watch?...` tab open. Select Manual A, confirm `Current mode: A`, and normally reload that same tab. The extension performs no URL rewrite, redirect, or navigation. Visually verify Desktop Web, native viewport, playback, Native Live Chat, and chat input. In desktop DevTools, inspect the reloaded main document and confirm that only `User-Agent` uses the fixture while UA-CH remains Native. Return Manual Mode to OFF afterward.

For a manual A/S1 check: open the runner, select A, confirm `Current mode: A`, open a fresh Quetta tab, navigate to the chosen YouTube Live URL, verify actual playback, inspect Native Live Chat content and its input field, confirm there is no old-browser warning, then return Manual Mode to OFF and use a fresh navigation to confirm Native restoration.

### Mobile UA-only mode (observed)

On PC Chromium, Mobile sets only the Quetta Native-baseline Mobile Chrome/Android UA on `main_frame` requests to the explicit `www` and `m` hosts. It does not change UA-CH, JavaScript-visible identity, viewport, or subresources. This experiment fixture is not a fixed product Mobile Profile.

Load this directory unpacked in PC Chromium, keep normal desktop viewport with device emulation off, retain an existing `www.youtube.com` watch tab, select Manual Mobile, and confirm `Current mode: MOBILE` plus badge `MOB`. Normally reload the same tab; the extension performs no URL/host rewrite, forced navigation, or redirect. Observe Mobile Web, viewport, playback, Live Chat, chat input, old-browser warning, and final host. If needed, minimally confirm the main-document Mobile UA and unchanged native PC UA-CH in DevTools. Return to OFF afterward. Run All remains the unchanged OFF/A/B/C/D/OFF-recovery sequence and excludes Mobile.

In the observed PC test, reloading an existing `www.youtube.com` tab at normal PC viewport passed Mobile Web, viewport retention, and playback with no old-browser warning. YouTube itself moved to `m.youtube.com`; the extension did not transform the URL. DevTools confirmed the fixture UA on the `m.youtube.com` main document. Native Live Chat and chat input were hidden by Mobile Web design and are recorded as `EXPECTED: NOT AVAILABLE BY MOBILE WEB DESIGN`, not as a Mobile Profile failure. This result is specific to YouTube on the tested PC Chrome and is not generalized to other sites or all Chromium browsers.

### Automated and manual assessment

V records inner and screen dimensions, DPR, and an Xperia-experiment portrait heuristic without defining a product pixel threshold. D combines multiple desktop and mobile custom-element signals. L combines account/avatar and Sign-in UI signals without reading identifiers or credentials. C records chat structure and a boolean old-browser-warning signal; visible structure without an error still returns `MANUAL_CHECK_REQUIRED`. B records video plus separate evidence for error-component presence, actual visibility, active player-error state, and visible error text. Hidden error components no longer count as errors; uncertain visible states prefer manual review. Actual playback is not automated. Ambiguous cases remain `UNKNOWN`; a missing live URL produces `NOT_TESTED` for chat.

Humans must still confirm usable Native Live Chat, actual playback/basic navigation, and visual native viewport preservation. The automation does not declare overall functional PASS. LiveFlow/NicoFlow are optional observations outside the success criteria.

### Rule configuration, wire verification, and output

For every step, `getSessionRules()` records mode, rule ID, resource types, and configured request headers. This is **Rule configuration**, not actual wire evidence. `wireVerification` is always `NOT_CAPTURED`; use separate PC-side CDP/DevTools verification. Rule acceptance never establishes Wire VALID or functional causation.

The UI displays progress and JSON, the service worker console receives the completed sanitized report, and `Copy Result JSON` copies it. The schema and example are identical to the Japanese section. It stores only a test timestamp and a generic target kind—never the full URL, query, video ID, title, account data, cookie/auth data, or page text.

### Observed device result

The first run exposed two diagnostics defects: OFF mobile documents on `m.youtube.com` lacked a receiver, and hidden error components caused false playability errors. Both were corrected without changing DNR rules.

After the fixes, Run All reported true native-narrow-viewport, Desktop Web, login, and Live Chat component/frame/frame-loaded signals in A/B/C/D, with false old-browser-warning and confirmed-playability-error signals. OFF and OFF recovery diagnosed Native narrow viewport and Mobile Web without automation errors and restored correctly.

Separate DevTools verification of A/S1 showed only UA changed to the Windows Chrome 154 fixture; low- and high-entropy UA-CH remained Native Quetta/Android/Mobile. Manual Desktop Web, viewport, login, playback, Native Live Chat, chat input, and warning checks passed, a fresh navigation reproduced the result, and final OFF recovery passed. The incremental sequence stops at A for this device/build. See `../../YOUTUBE_FUNCTIONAL_AB_RESULTS.md`.

The existing-Mobile-tab test passed: Manual A changed the `m.youtube.com` main-document UA to the fixture, and normal reload passed Desktop Web, native viewport, playback, Native Live Chat, and chat input. YouTube itself ultimately moved to its `www.youtube.com` desktop URL; the extension performed no URL rewrite, navigation, or redirect. This applies only to the tested YouTube/device build, not every Chromium browser or other site, and Chrome 154 is not a product default.

### Known limitations and safety

YouTube DOM experiments, localization, dynamic loading, Android background throttling, and Quetta lifecycle can yield `UNKNOWN` or timing failures. Frame presence does not prove usable chat. A/Mobile touch exactly `www` and `m`; B/C/D touch only `www`; every other host is untouched. Subresources retain Native identity. Mobile was observed only on the tested PC Chrome and YouTube condition.

Do not implement or collect youtubei payloads, `clientName`/`clientVersion`, visitorData, cookies/auth/OAuth, Native Live Chat APIs, endpoint-specific spoofing, response-triggered changes, proxy/IP changes, fingerprint randomization, or navigator/Worker patching. There is no telemetry, analytics, external test endpoint, persistent storage, or request/page-content storage.
