# UI Specification / UI 仕様

## 日本語

action popup は1カラム、横スクロールなし、主要操作を1画面内に置く。上から product name、Current Site（registrable domain 表示、実際の権限範囲は origin）、現在の適用状態、2つの大きな profile radio card、Remember this site、主ボタン `Apply & Reload`、短い permission/status 文を並べる。

tap target は最低 44×44 CSS px、本文 16px 相当、keyboard focus と visible focus ring、色だけに依存しない状態表示を用いる。Desktop でも popup を不必要に拡大しない（目安 320–400 CSS px）。未対応 URL（`chrome://`、Extension page、file URL 未許可等）では適用ボタンを無効化し理由を示す。

設定画面は global default、保存済み origin/profile 一覧、個別削除、permission 状態、データ全削除を備える。高度な header editor、version list、import/export は置かない。profile 適用時に permission がなければ、同じ user gesture の流れで current origin のみ要求する。reload 後に反映されることを明記する。

## English

The action popup is a single column with no horizontal scrolling and all primary actions visible on one screen. It contains the product name, Current Site (registrable domain for display; origin for permission scope), current state, two large profile radio cards, Remember this site, the primary `Apply & Reload` button, and a short permission/status message.

Use at least 44×44 CSS-pixel targets, roughly 16px body text, keyboard operation, visible focus rings, and state indicators not based on color alone. Keep the desktop popup compact (about 320–400 CSS px). On unsupported URLs (`chrome://`, extension pages, unapproved file URLs), disable Apply and explain why.

Settings contain global default, saved origin/profile rows, individual deletion, permission status, and delete-all-data. Do not add a header editor, version catalog, or import/export. If permission is absent, request only the current origin in the same user-gesture flow. State that changes take effect after reload.
