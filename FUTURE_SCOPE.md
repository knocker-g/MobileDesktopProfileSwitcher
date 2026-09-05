# Future Scope / 将来範囲

## 日本語

MVP 後の候補: 追加 Chromium browser の compatibility matrix、検証済みProfile Setの通常package release更新、read-only Profile Set診断表示、accessibility/localization 改善、permission cleanup 支援、診断 export（ユーザー確認後、secret/page content を除外）。Profile Set更新はremote configやruntime latest取得を使わず、同一milestoneのDesktop/Mobileを再検証して配布する。

将来も対象外のまま: randomization、service-specific internal API spoof、restriction bypass、Cookie/auth 変更、外部 tracking、LiveFlow/NicoFlow 連携。scope 追加は single purpose と permission 最小性を再評価する。

## English

Post-MVP candidates: compatibility matrices for more Chromium browsers; validated Profile Set updates delivered as normal packaged releases; a read-only Profile Set diagnostic display; accessibility/localization improvements; permission-cleanup assistance; and user-reviewed diagnostic export with secrets/page content excluded. Set updates use neither remote configuration nor runtime latest-version lookup and revalidate Desktop and Mobile at the same milestone before release.

Randomization, service-specific internal API spoofing, restriction bypass, cookie/auth changes, external tracking, and LiveFlow/NicoFlow integration remain out of scope. Every addition requires renewed single-purpose and minimum-permission review.
