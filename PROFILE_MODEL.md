# Profile Model / profile モデル

## 日本語

MVP profileの第一候補は`Default`、`Desktop`、`Mobile`の3つとする。`Default`はidentity変更なし、`Desktop`と`Mobile`は検証済みのUA-only `main_frame`方式を採る。ただし具体的な製品UA値とversion管理方針は未確定である。

`Default`はExtensionによるidentity変更なし。`Desktop`と`Mobile`の製品fixtureは、versionを無検証で自動追従する値ではなく、検証済みの管理値とする。fixtureは`id`、schema version、display name、HTTP header values、検証したbrowser build/date、既知の制約を持つ。ユーザーがarbitrary valueを編集する機能は持たない。

Desktop Chrome 154とMobile Chrome/Android 148は実験fixtureにすぎず、製品値として確定しない。YouTubeではDesktop/Mobileとも`User-Agent`だけで成立し、UA-CHやMAIN-world navigator整合は不要だった。製品fixtureのversion選定・更新・互換性確認方法は別途決定する。

### 今回の調査後の第一候補

UI上のprofile名はOS名やUA文字列ではなく`Default`、`Desktop`、`Mobile`を前面に出す。`Default`は変更なし。YouTube実測では`Desktop`と`Mobile`の双方が、明示的な`www.youtube.com`/`m.youtube.com`の`main_frame`に対するUA-onlyで成立したため、両方をMVPの第一候補とする。この結果はYouTube固有であり、他siteや全Chromiumへ一般化しない。

YouTubeの実測ではWindows Chrome 154 UA fixtureで成立したが、このversionはproduct defaultではない。大量のUA/version/OS選択肢やarbitrary editorを提供する一般UA Switcherにはしない。

## English

The first MVP candidate has three profiles: `Default`, `Desktop`, and `Mobile`. Default makes no identity change; Desktop and Mobile use the validated UA-only `main_frame` approach. The concrete product UA values and version-management policy remain undecided.

Default means no identity modification by the extension. Product fixtures for Desktop and Mobile are validated managed values, not versions that automatically follow an untested latest release. A fixture records its ID, schema version, display name, HTTP header values, tested browser build/date, and known limitations. Arbitrary user editing is excluded.

Desktop Chrome 154 and Mobile Chrome/Android 148 are experiment fixtures, not committed product values. Both Desktop and Mobile succeeded on YouTube with only `User-Agent`; UA-CH and MAIN-world navigator consistency were unnecessary. Product fixture version selection, updates, and compatibility validation remain separate decisions.

### Post-investigation first candidate

Present `Default`, `Desktop`, and `Mobile` as user-facing profile names rather than OS names or UA strings. Default makes no change. YouTube observation validated both Desktop and Mobile using UA-only on `main_frame` for the explicit `www.youtube.com`/`m.youtube.com` host set, so both are first MVP candidates. This is YouTube-specific and is not generalized to other sites or all Chromium browsers.

The YouTube experiment passed with a Windows Chrome 154 UA fixture, but that version is not the product default. Do not become a general UA switcher with large UA/version/OS catalogs or arbitrary editing.
