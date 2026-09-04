# Future Scope / 将来範囲

## 日本語

MVP 後の候補: 検証済み `Mobile Chrome` profile、追加 Chromium browser の compatibility matrix、profile fixture の署名付き release 更新（code/package update として配布し remote config は使わない）、accessibility/localization 改善、permission cleanup 支援、診断 export（ユーザー確認後、secret/page content を除外）。

将来も対象外のまま: randomization、service-specific internal API spoof、restriction bypass、Cookie/auth 変更、外部 tracking、LiveFlow/NicoFlow 連携。scope 追加は single purpose と permission 最小性を再評価する。

## English

Post-MVP candidates: a validated `Mobile Chrome` profile; compatibility matrices for more Chromium browsers; signed fixture updates delivered as normal packaged releases, never remote configuration; accessibility/localization improvements; permission-cleanup assistance; and user-reviewed diagnostic export with secrets/page content excluded.

Randomization, service-specific internal API spoofing, restriction bypass, cookie/auth changes, external tracking, and LiveFlow/NicoFlow integration remain out of scope. Every addition requires renewed single-purpose and minimum-permission review.
