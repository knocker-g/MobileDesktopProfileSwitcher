# Profile Model / profile モデル

## 日本語

MVP profile は `default` と `desktop-chrome` の2つ。`mobile-chrome` は将来候補であり MVP 必須ではない。

`default` は Extension による identity 変更なし。`desktop-chrome` は version を自動追従する疑似 profile ではなく、検証済みの固定 fixture とする。fixture は `id`、schema version、display name、HTTP header values、必要なら JavaScript-visible values、検証した browser build/date、既知の制約を持つ。ユーザーが arbitrary value を編集する機能は持たない。

Chrome 154 は既存実験の入力値にすぎず製品値として確定しない。MVP fixture は A/B 試験で、(A) `User-Agent` のみ、(B) low-entropy UA-CH 追加、(C) MAIN-world navigator 整合を比較してから固定する。不整合が大きい値は profile に含めない。

### 今回の調査後の第一候補

UI上のprofile名はOS名やUA文字列ではなく`Default`、`Desktop`、`Mobile`を前面に出す。`Default`は変更なし、`Desktop`は検証済みUA-only `main_frame` profileを第一候補とする。`Mobile`はMobile Chrome / Android UA-only `main_frame`の候補だが、未実機検証のため確定profileやMVP必須機能として扱わない。

YouTubeの実測ではWindows Chrome 154 UA fixtureで成立したが、このversionはproduct defaultではない。大量のUA/version/OS選択肢やarbitrary editorを提供する一般UA Switcherにはしない。

## English

MVP has two profiles: `default` and `desktop-chrome`. `mobile-chrome` is a future candidate, not an MVP requirement.

`default` means no identity modification by the extension. `desktop-chrome` is a validated, fixed fixture—not an automatically guessed latest version. A fixture records its ID, schema version, display name, HTTP header values, optional JavaScript-visible values, tested browser build/date, and known limitations. Arbitrary user editing is excluded.

Chrome 154 is only an input from the prior experiment, not a committed product value. The MVP fixture is fixed after comparing (A) `User-Agent` only, (B) added low-entropy UA-CH, and (C) MAIN-world navigator consistency. Values that create material inconsistency are excluded.

### Post-investigation first candidate

Present `Default`, `Desktop`, and `Mobile` as user-facing profile names rather than OS names or UA strings. Default makes no change. Desktop first uses a validated UA-only `main_frame` profile. Mobile is a candidate UA-only Mobile Chrome/Android main-frame profile, but it is not confirmed or required for MVP until device testing passes.

The YouTube experiment passed with a Windows Chrome 154 UA fixture, but that version is not the product default. Do not become a general UA switcher with large UA/version/OS catalogs or arbitrary editing.
