# Safety Boundaries / 安全境界

## 日本語

技術的に可能でも公開製品として採用しない境界:

- undocumented/unsupported API、CDP、`debugger`、native helper に依存しない。
- service-specific request body、YouTube internal client ID、authentication、Cookie を変更しない。
- page function の広範囲 hook、worker constructor 差替え、CSP 回避、外部 code 読込をしない。
- install 時の全 site 常時 access、閲覧監視、error code に応じた profile rotation をしない。
- identity の完全性を保証できないとき「完全な Desktop Chrome」と表示しない。

Safety gate: HTTP と JS の整合に Worker/API の侵襲的 patch が必須なら NO-GO。固定 UA + optional origin permission + 小さな DNR rule で目的を満たすなら GO。最小 MAIN-world patch が必要だが監査可能で site 非依存、漏れが許容できる場合のみ CONDITIONAL GO。

## English

Even when technically possible, the public product will not depend on undocumented APIs, CDP, `debugger`, or native helpers; alter service-specific bodies, YouTube internal client IDs, authentication, or cookies; broadly hook page functions or worker constructors; bypass CSP; load remote code; request permanent all-sites access at install; monitor browsing; rotate profiles on errors; or claim a complete Desktop Chrome identity when consistency is not guaranteed.

Safety gate: NO-GO if consistency requires invasive Worker/API patching. GO if fixed UA plus optional origin permission and small DNR rules meet the goal. CONDITIONAL GO only if a tiny, auditable, service-independent MAIN-world patch is necessary and its gaps are acceptable.
