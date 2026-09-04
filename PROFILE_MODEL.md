# Profile Model / profile モデル

## 日本語

MVP profile は `default` と `desktop-chrome` の2つ。`mobile-chrome` は将来候補であり MVP 必須ではない。

`default` は Extension による identity 変更なし。`desktop-chrome` は version を自動追従する疑似 profile ではなく、検証済みの固定 fixture とする。fixture は `id`、schema version、display name、HTTP header values、必要なら JavaScript-visible values、検証した browser build/date、既知の制約を持つ。ユーザーが arbitrary value を編集する機能は持たない。

Chrome 154 は既存実験の入力値にすぎず製品値として確定しない。MVP fixture は A/B 試験で、(A) `User-Agent` のみ、(B) low-entropy UA-CH 追加、(C) MAIN-world navigator 整合を比較してから固定する。不整合が大きい値は profile に含めない。

## English

MVP has two profiles: `default` and `desktop-chrome`. `mobile-chrome` is a future candidate, not an MVP requirement.

`default` means no identity modification by the extension. `desktop-chrome` is a validated, fixed fixture—not an automatically guessed latest version. A fixture records its ID, schema version, display name, HTTP header values, optional JavaScript-visible values, tested browser build/date, and known limitations. Arbitrary user editing is excluded.

Chrome 154 is only an input from the prior experiment, not a committed product value. The MVP fixture is fixed after comparing (A) `User-Agent` only, (B) added low-entropy UA-CH, and (C) MAIN-world navigator consistency. Values that create material inconsistency are excluded.
