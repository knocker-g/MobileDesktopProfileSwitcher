# Baseline Identity Analysis / Baseline Identity解析

## 日本語

### 実測環境と安全確認

2026-09-04に、Sony Xperia 1 V、Quetta Android、Quetta「PC版サイト」OFF、Android native narrow viewport、同一Identity Probeで各baselineを5回採取した。NativeはUser-Agent Switcher and Manager OFF、Successは成功確認済みDesktop Chrome/Windows profile ONで、YouTube Desktop Web、login、通常動画、Native Live Chatの成功が利用者により確認されている。

10 JSONはすべてvalidで同一schema、各4,773 bytesだった。key/value scanでCookie、authentication/session/account token、email、query付きURL、storage内容、個人情報は検出されなかった。端末model `SOG10`、Android/Quetta version相当、language、timestampを含むためbrowser/device fingerprint資料ではある。

### 5-run stability

| Baseline | run数 | timestamp除外後のdistinct結果 | status | 判定 |
|---|---:|---:|---|---|
| Native | 5 | 1 | 全field `available`、errorなし | identityは5回完全一致 |
| Success | 5 | 1 | 全field `available`、errorなし | identityは5回完全一致 |

変化したのは各runの`timestamp`のみ。`schemaVersion`、`secureContext: true`、`visibilityState: visible`を含む他の全JSON内容はbaseline内で一致した。timestampはidentity比較から除外した。

### Native vs Success差分（Observed）

| Context / property | Native実測値 | Success実測値 | 分類 |
|---|---|---|---|
| Page `navigator.userAgent` | `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36` | 同左 | unchanged |
| Page `navigator.platform` | `Linux armv81` | 同左 | unchanged |
| Page `navigator.vendor` | `Google Inc.` | 同左 | unchanged |
| Page `navigator.product` | `Gecko` | 同左 | unchanged |
| Page `navigator.appVersion` | 上記UAから`Mozilla/`を除いたAndroid/Mobile文字列 | 同左 | unchanged |
| Page `navigator.language` / `languages` | `ja-JP` / `["ja-JP"]` | 同左 | unchanged |
| Page UAData `brands` | Chromium 148、Quetta 148、Not/A)Brand 99（同一順序） | 同左 | unchanged |
| Page UAData `mobile` / `platform` | `true` / `Android` | 同左 | unchanged |
| Page high entropy | architecture `""`、bitness `""`、model `SOG10`、platformVersion `15.0.0`、uaFullVersion `148.0.0.0`、同一fullVersionList | 同左 | unchanged |
| Worker `navigator.userAgent` | Pageと同じAndroid/Mobile UA | 同左 | unchanged |
| Worker `navigator.platform` | `Linux armv81` | 同左 | unchanged |
| Worker UAData low/high entropy | Pageと同じ | 同左 | unchanged |

`appVersion`と`fullVersionList`の完全なraw値も全runで一致している。表では可読性のため要約した。unavailable、unsupported、error、inconclusiveに分類されたidentity fieldはない。

### Page vs Worker（Observed）

全10runでPage/Workerの`userAgent`、`platform`、UAData low entropy、high entropyは完全一致した。SuccessでもWorkerにだけ異なるidentityはなく、逆にPageだけWindowsへ変更されたpropertyもない。`vendor`、`product`、`appVersion`、languageはProbeがWorkerで採取していないためPage/Worker比較はUnknownであり、unavailableとは分類しない。

### Observed / Inferred / Unknown

**Observed:** Success時も、観測したJavaScript-visible Page/Worker identityはすべてnative Android/Quetta値のままである。Success profile設定値の`Win32`等はこのProbeのPage実測には現れなかった。Success機能結果とJS identity不変は同じ条件で共存した。

**Inferred:** 当該環境・当該成功条件では、一般的なPage/Worker JS identity変更はYouTube Desktop Web + Native Live Chat成立に必要でない可能性が高い。この推定はA/B因果試験ではなく、他site/browser/versionへ一般化しない。

**Unknown:** 成功Extensionが実際に変更したHTTP header、request scope、rule timing、HTTP identityのどの差がDesktop Web/Live Chatに必要か。JS値を根拠にwire値を確定しない。Live Chatに`platform=Win32`等が必要という因果も証明されていない。

### 次のA/B候補

| 分類 | 対象 | 理由 |
|---|---|---|
| Must test | wire `User-Agent`、`Sec-CH-UA`、`Sec-CH-UA-Mobile`、`Sec-CH-UA-Platform` | JSが不変でもSuccess成立。実差分はHTTP側にある可能性があり、まずNative/Successを観測する必要がある |
| Must test | `User-Agent`の`main_frame`単独と、必要時のsame-origin scope | minimum modificationと因果を分離する中心試験 |
| Probably test | wireで差が確認されたlow-entropy UA-CHを一項目ずつ | 差がなければ試験しない |
| Probably unnecessary | Page legacy navigator、Page UAData low/high entropy、Worker identity | Successで変更されていないため、初期profile候補から外す |
| Cannot determine yet | wire high-entropy Client Hints | JSON対象外で、server opt-in/request context依存 |

### HTTP wireとして残る課題

同一run条件で、最初のtop-level navigation、redirect、same-origin subresourceを分離してNative/SuccessのHTTP `User-Agent`とUA-CHを観測する。管理下の中立HTTPS echoまたはbrowser Network表示を用い、Cookie、Authorization、bodyは保存しない。値、headerの有無、scopeだけを記録する。wire観測前にUA文字列やClient Hintsを推測してfixture化しない。

### Raw JSONのGit取扱い

repository sizeは約48 KBで問題ないが、10本はtimestampを除き重複し、`SOG10`、language、browser/OS versionを含むdevice fingerprint資料である。直接のsecret/個人identifierは検出されなかったものの、将来のpublic GitHubにraw captureを置く再現性上の利益は小さい。推奨はraw JSONをGit ignoreし、この正規化済み・レビュー済み解析だけをcommitすること。`.gitignore`を`investigation/results/baseline/*.json`に限定して更新した。rawはアクセス管理されたローカル保管とし、共有時はtimestamp/model等の必要性を再評価する。

## English

### Environment and safety review

On 2026-09-04, five runs per baseline were captured with the same Identity Probe on Sony Xperia 1 V and Quetta Android, Quetta Desktop Site OFF, and the native narrow viewport. Native had User-Agent Switcher and Manager OFF. Success used the proven Desktop Chrome/Windows profile; the user confirmed YouTube Desktop Web, login, playback, and Native Live Chat.

All ten JSON files are valid, use the same schema, and are 4,773 bytes each. Key/value scans found no cookie, authentication/session/account token, email, query-bearing URL, storage content, or personal information. They do contain device model `SOG10`, Android/Quetta version-like data, language, and timestamps, so they are browser/device fingerprint records.

### Five-run stability

| Baseline | Runs | Distinct results excluding timestamp | Status | Result |
|---|---:|---:|---|---|
| Native | 5 | 1 | Every field `available`; no errors | Exact identity match across five runs |
| Success | 5 | 1 | Every field `available`; no errors | Exact identity match across five runs |

Only `timestamp` changed. All other JSON, including schema, secure context, and visibility, was stable and timestamp was excluded from identity comparison.

### Native vs Success (Observed)

Every Page field listed in the Japanese table was unchanged: Android/Mobile Chrome 148 UA and appVersion, `Linux armv81`, `Google Inc.`, `Gecko`, `ja-JP`; UAData brands Chromium/Quetta 148 plus Not/A)Brand 99 in identical order, `mobile: true`, `platform: Android`; and high entropy empty architecture/bitness, model `SOG10`, platform `15.0.0`, full version `148.0.0.0`, and identical fullVersionList. Worker UA, platform, and low/high-entropy UAData were also unchanged. No identity field was unavailable, unsupported, erroneous, or inconclusive.

### Page vs Worker (Observed)

In all ten runs, Page and Worker `userAgent`, `platform`, low-entropy UAData, and high-entropy UAData matched exactly. Success had neither a Worker-only difference nor a Page-only Windows identity. Worker vendor, product, appVersion, and language were not collected by this Probe, so that comparison is Unknown, not unavailable.

### Observed / Inferred / Unknown

**Observed:** every measured JavaScript-visible Page/Worker identity remained native Android/Quetta during Success. Configured Success values such as `Win32` did not appear in Page measurements. Successful functions and unchanged JS identity coexisted.

**Inferred:** broad Page/Worker JS identity modification is probably unnecessary for the tested outcome in this exact environment. This is not causal A/B proof and is not generalized to other sites, browsers, or versions.

**Unknown:** actual HTTP changes, request scope/timing, and which HTTP difference causes Desktop Web or Live Chat success. Never infer wire values from JS. No causal requirement for `platform=Win32` or another property is proven.

### Next A/B candidates

Must test the wire `User-Agent` and low-entropy UA-CH Native/Success differences, followed by main-frame-only UA and same-origin scope only if needed. Probably test only low-entropy UA-CH fields that actually differ on the wire. Page legacy identity, Page UAData, high entropy, and Worker identity are probably unnecessary and leave the initial profile. Wire high-entropy hints cannot yet be determined.

### Remaining HTTP wire work

Observe Native/Success HTTP UA and UA-CH for first top-level navigation, redirects, and same-origin subresources using a controlled neutral HTTPS echo or browser Network view. Record only values, presence, and scope—never cookies, Authorization, or bodies. Do not guess a fixture before measurement.

### Raw JSON Git handling

Size is negligible at about 48 KB, but the ten captures are duplicates except for timestamps and contain device model, language, and browser/OS versions. No direct secret or personal identifier was found, yet the public-repository reproducibility value is low. Recommend ignoring raw JSON and committing only this normalized, reviewed analysis. `.gitignore` is narrowly updated for `investigation/results/baseline/*.json`; retain raw files locally with controlled access and reassess timestamps/model before sharing.
