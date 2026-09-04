# MVP Scope / MVP 範囲

## 日本語

含む: `Default` と実験で固定した `Desktop Chrome`、current origin の明示 permission request、一時適用、origin ごとの記憶、global default（許可済み origin にのみ有効）、Apply & Reload、設定一覧/削除、local-only storage、Android mobile-first popup、Desktop 対応、診断用の手動 test checklist。

MVP 完了条件: 最小 A/B test 合格、Quetta Android と Desktop Chrome で rule lifecycle/permission revoke/restore を確認、YouTube Desktop Web と Native Live Chat の結果を再現可能に記録、identity inconsistency を許容基準内に限定、CWS policy review checklist 合格。

含まない: `Mobile Chrome`（実験で明確な価値が出た場合のみ追加）、custom editor、auto-update UA、all-site install grant、service-specific logic、remote service。

## English

Includes: `Default` and a test-fixed `Desktop Chrome`; explicit current-origin permission; temporary use; remembered per-origin settings; global default effective only on granted origins; Apply & Reload; settings list/deletion; local-only storage; Android-first popup; desktop support; and a manual diagnostic checklist.

MVP completion requires passing the minimal A/B test, validating rule lifecycle/permission revoke/restore on Quetta Android and desktop Chrome, reproducibly recording YouTube Desktop Web and Native Live Chat results, bounding identity inconsistency, and passing the CWS policy checklist.

Excluded: `Mobile Chrome` unless tests show clear value, custom editing, automatic UA updates, install-time all-site grants, service-specific logic, and remote services.
