# YouTube Functional A/B Results / YouTube機能A/B試験結果

## 日本語

### 実測環境とA/S1

Sony Xperia 1 V、Quetta Android 148、Quetta「PC版サイト」OFF、Android native viewportで実施した。対象は`https://www.youtube.com/*`の`main_frame`のみ。A/S1は`User-Agent`だけをWindows Chrome 154 experiment fixtureへ変更し、UA-CH、Page/Worker JavaScript-visible identity、subresourceは変更しない。

Chrome 154は再現実験用fixtureであり、product defaultではない。

### Observed: actual wire identity

YouTube Live pageのmain document requestで次を観測した。

| Header | A/S1 wire value | 状態 |
|---|---|---|
| `User-Agent` | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36` | fixtureへ変更 |
| `Sec-CH-UA` | `"Chromium";v="148", "Quetta";v="148", "Not/A)Brand";v="99"` | Native維持 |
| `Sec-CH-UA-Mobile` | `?1` | Native維持 |
| `Sec-CH-UA-Platform` | `"Android"` | Native維持 |
| `Sec-CH-UA-Full-Version-List` | `"Chromium";v="148.0.0.0", "Quetta";v="148.0.0.0", "Not/A)Brand";v="99.0.0.0"` | Native維持 |
| `Sec-CH-UA-Model` | `"SOG10"` | Native維持 |
| `Sec-CH-UA-Platform-Version` | `"15.0.0"` | Native維持 |

actual wire上でもUAはWindows Chrome 154、UA-CHはQuetta/Android/Mobileという不一致状態だった。

### Observed: functional result and reproduction

| Outcome | Initial A/S1 | Fresh-navigation reproduction |
|---|---|---|
| Android native narrow viewport | **PASS** | **PASS** |
| YouTube Desktop Web | **PASS** | **PASS** |
| Login | **PASS**（runner diagnostic） | 維持 |
| Video playback | **PASS** | **PASS** |
| Native Live Chat | **PASS** | **PASS** |
| Chat input | **PASS** | **PASS** |
| Old-browser warning | NO | NO |

終了後のfinal OFF recoveryも**PASS**した。

修正後Run AllではA/B/C/Dすべてでnative narrow viewport heuristic、Desktop Web、login、Live Chat component/frame/frameLoadedが`true`、old-browser warningとconfirmed playability errorが`false`だった。OFF/OFF recoveryはNative narrow viewportとMobile Webを維持し、automation errorなく正常に診断できた。

### Inferred: A/B判断

今回の実機/buildとYouTube検証条件では、OFFに対してA/S1が機能成立し、fresh navigationでも再現したため、`User-Agent`だけが現在の最小候補である。Aで停止し、B/C/Dのmanual functional testは不要とする。この成立条件ではUA-CHおよびPage/Worker JavaScript-visible identityの変更は必要なかった。製品MVPではUA-only方式を第一候補とする。

これは全Chromium browser、他Quetta build、将来のYouTube、一般Web、または任意のChrome versionへ一般化しない。製品既定UA/version、lifecycle、general-site compatibility、CWS方針は別途検証する。

### Observed: explicit multi-host A/S1

A/S1の対象を`www.youtube.com`と`m.youtube.com`の明示的2hostへ限定拡張し、両方とも`main_frame`の`User-Agent`だけを変更した。Native Mobile状態で開いた既存`m.youtube.com` watch tabを保持し、Manual Aを有効化して同じtabを通常reloadした。

PC DevToolsで`m.youtube.com`のmain document requestにWindows Chrome 154 fixtureの`User-Agent`が適用されたことを確認した。Desktop Web、native narrow viewport、動画再生、Native Live Chat、chat入力がすべて**PASS**し、old-browser warningはなかった。その後YouTube自身が`www.youtube.com`のdesktop watch URLへ移行した。ExtensionはURL rewrite、navigation、redirectを実行していない。

従って今回の実機/buildのYouTubeでは、`www.youtube.com`と`m.youtube.com`を同一Desktop Profileの明示host集合とし、両hostの`main_frame`へUA-only ruleを適用する構成が成立した。Extension側canonicalizationや強制navigationは不要だった。これはYouTube固有のObserved resultであり、他siteへ一般化しない。

### Diagnostics corrections

初回runnerのOFF接続失敗は、Native Mobileの最終documentが`m.youtube.com`へ遷移すると旧`www`限定content scriptが存在しないことと整合した。diagnostics content scriptだけを`m.youtube.com`にも対応させ、DNR scopeは拡張していない。旧playability判定はhidden error componentの存在だけでtrueになったため、可視性、active player error state、可視error文言を組み合わせる保守的判定へ修正した。

### Observed: Mobile UA-only Profile（PC Chrome）

PC版Chromeをdevice emulationなしの通常viewportで使用した。Mobile modeは`https://www.youtube.com/*`と`https://m.youtube.com/*`の`main_frame`だけを対象とし、次のexperiment fixtureを`User-Agent`だけへ設定した。

`Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36`

UA-CH、JavaScript-visible identity、viewport、subresourceは変更していない。ExtensionによるURL rewrite、host変換、強制navigation、redirectもない。通常のPC版YouTubeを開いた既存tabでMobile modeを有効化し、同じtabを通常reloadした。

| Outcome | Mobile UA-only |
|---|---|
| YouTube Mobile Web | **PASS** |
| PC viewport維持 | **PASS** |
| Video playback | **PASS** |
| Old-browser warning | NO |
| Native Live Chat | **EXPECTED: NOT AVAILABLE BY MOBILE WEB DESIGN** |
| Chat input | **EXPECTED: NOT AVAILABLE BY MOBILE WEB DESIGN** |

最終URLは`https://m.youtube.com/watch?v=rYzvSk_YWIY`で、YouTube自身が`www.youtube.com`から`m.youtube.com`へ移行した。ExtensionはURLを変更していない。DevToolsでは`m.youtube.com` main document requestの`User-Agent`が上記Mobile fixtureと完全一致し、Mobile UA-only ruleのwire適用を確認した。UA-CHは変更対象外であり、この試験では実測値を確定していない。

今回のPC Chrome + YouTube条件では、`main_frame`のUA-only変更でPC viewportを維持したままMobile Webと動画再生が成立した。Mobile WebでNative Live Chatと入力欄が非表示なのは期待される挙動であり、Mobile ProfileのFAILではない。拡張側canonicalizationや強制navigationは不要だった。この結論はYouTube固有のObserved resultであり、他site、全Chromium、将来のYouTubeへ一般化しない。fixtureはproduct defaultではなく、製品UA version管理方針は未確定である。

## English

### Environment and A/S1

Testing used a Sony Xperia 1 V with Quetta Android 148, Desktop Site off, and the Android native viewport. A/S1 targets only `main_frame` requests to `https://www.youtube.com/*`. It changes only `User-Agent` to the Windows Chrome 154 experiment fixture; UA-CH, Page/Worker JavaScript-visible identity, and subresources remain Native. Chrome 154 is an experiment fixture, not a product default.

### Observed: actual wire identity

The main document sent the exact values in the Japanese wire table. UA changed to Windows Chrome 154. `Sec-CH-UA` remained Chromium/Quetta 148, Mobile remained `?1`, Platform remained `"Android"`, Full-Version-List remained Chromium/Quetta 148.0.0.0, Model remained `"SOG10"`, and Platform-Version remained `"15.0.0"`. Thus the successful wire identity was mismatched: desktop Windows UA with Native Quetta/Android/Mobile UA-CH.

### Observed: functional result and reproduction

The initial A/S1 run passed native narrow viewport, Desktop Web, login retention by runner diagnostics, video playback, Native Live Chat, and chat input, with no old-browser warning. A fresh-navigation manual reproduction again passed viewport, Desktop Web, video playback, Native Live Chat, and chat input, with no warning. Final OFF recovery passed.

After diagnostics fixes, Run All reported true native-narrow-viewport, Desktop Web, login, and Live Chat component/frame/frame-loaded signals in A/B/C/D, with false old-browser-warning and confirmed-playability-error signals. OFF and OFF recovery retained Native narrow viewport and Mobile Web without automation errors.

### Inferred A/B decision

For this device/build and YouTube test condition, OFF versus reproducible A/S1 establishes UA-only as the current minimum candidate. Stop the incremental sequence at A; no manual B/C/D functional run is required. UA-CH and Page/Worker identity changes were unnecessary for this observed success condition, so a UA-only product MVP approach is the first candidate.

Do not generalize this to all Chromium browsers, other builds, future YouTube behavior, general websites, or a product-default Chrome version. Product UA/version choice, lifecycle behavior, general-site compatibility, and CWS alignment remain separate gates.

### Observed explicit multi-host A/S1

A/S1 was narrowly extended to the two explicit hosts `www.youtube.com` and `m.youtube.com`, modifying only `User-Agent` on `main_frame`. A Native Mobile `m.youtube.com` watch tab was retained, Manual A was enabled, and that same tab was normally reloaded.

Desktop DevTools confirmed the Windows Chrome 154 fixture UA on the `m.youtube.com` main document request. Desktop Web, native narrow viewport, playback, Native Live Chat, and chat input all passed with no old-browser warning. YouTube itself subsequently moved to its desktop watch URL on `www.youtube.com`; the extension performed no URL rewrite, navigation, or redirect.

For YouTube on this device/build, one Desktop Profile can therefore bind the explicit host set `www.youtube.com` plus `m.youtube.com` and apply a UA-only main-frame rule on both. Extension-side canonicalization or forced navigation was unnecessary. This is a YouTube-specific observed result and is not generalized to other sites.

### Diagnostics corrections

The first runner's OFF connection failure was consistent with a Native Mobile final document on `m.youtube.com` lacking the former `www`-only content script. Diagnostics matching now covers mobile documents without extending DNR scope. The former playability check treated hidden error components as errors; the corrected conservative check combines visibility, active player-error state, and visible error text.

### Observed: Mobile UA-only Profile on PC Chrome

Testing used desktop Chrome at its normal PC viewport with no device emulation. Mobile mode targeted only `main_frame` on the explicit `https://www.youtube.com/*` and `https://m.youtube.com/*` hosts and set only `User-Agent` to this experiment fixture:

`Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36`

UA-CH, JavaScript-visible identity, viewport, and subresources were unchanged. The extension performed no URL rewrite, host conversion, forced navigation, or redirect. Mobile mode was enabled over an existing normal desktop YouTube tab, then that same tab was normally reloaded.

YouTube Mobile Web, retained PC viewport, and video playback all **PASSED**, with no old-browser warning. Native Live Chat and chat input were not displayed, which is **EXPECTED: NOT AVAILABLE BY MOBILE WEB DESIGN**, not a Mobile Profile failure.

The final URL was `https://m.youtube.com/watch?v=rYzvSk_YWIY`; YouTube itself moved from `www.youtube.com` to `m.youtube.com`. DevTools confirmed that the `m.youtube.com` main-document `User-Agent` exactly matched the Mobile fixture, establishing wire application of the Mobile UA-only rule. UA-CH was outside the modification scope and its values were not established by this test.

For this PC Chrome and YouTube condition, changing only main-frame UA produced Mobile Web and playback without changing the PC viewport. Extension-side canonicalization or forced navigation was unnecessary. This is a YouTube-specific observed result, not a general claim for other sites, every Chromium browser, or future YouTube behavior. The fixture is not a product default, and product UA-version management remains undecided.
