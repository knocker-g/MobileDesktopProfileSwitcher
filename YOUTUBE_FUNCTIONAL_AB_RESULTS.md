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

### Separate issue: `m.youtube.com`

Native Mobile状態の既存`m.youtube.com` tabでは、Aを有効化して単純reloadしても`www.youtube.com`限定DNR ruleが適用されずMobile Webのままだった。これはUA-only identityの失敗ではなく、host canonicalization、profile切替時navigation、host scopeに関する別のUX/architecture課題である。今回、製品コードで解決せず独立課題として残す。

### Diagnostics corrections

初回runnerのOFF接続失敗は、Native Mobileの最終documentが`m.youtube.com`へ遷移すると旧`www`限定content scriptが存在しないことと整合した。diagnostics content scriptだけを`m.youtube.com`にも対応させ、DNR scopeは拡張していない。旧playability判定はhidden error componentの存在だけでtrueになったため、可視性、active player error state、可視error文言を組み合わせる保守的判定へ修正した。

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

### Separate `m.youtube.com` issue

Reloading an existing Native Mobile `m.youtube.com` tab after enabling A did not match the `www.youtube.com`-only DNR rule and remained Mobile Web. This is not a UA-only identity failure; it is a separate host-canonicalization, profile-switch navigation, and host-scope UX/architecture issue. No product-code solution is implemented here.

### Diagnostics corrections

The first runner's OFF connection failure was consistent with a Native Mobile final document on `m.youtube.com` lacking the former `www`-only content script. Diagnostics matching now covers mobile documents without extending DNR scope. The former playability check treated hidden error components as errors; the corrected conservative check combines visibility, active player-error state, and visible error text.
