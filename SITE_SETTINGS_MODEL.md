# Site Settings Model / site 設定モデル

## 日本語

保存先は `chrome.storage.local` のみ。保存対象は次の最小情報とする。

- schema version
- global default profile ID（初期値 `default`）
- origin 単位の profile ID（scheme + host + effective port。path、query、title は保存しない）
- UI preference の最小値

permission grant 自体は browser が管理し、保存データを permission の根拠にしない。起動時・表示時に `chrome.permissions.contains()` 相当で再確認する。site 設定削除時は origin に他用途がなければ permission revoke を提案し、ユーザー操作で実行する。incognito は既定で別途保証しない。storage sync、外部 DB、閲覧履歴、アクセス時刻、ページ内容は保存しない。

## English

Use `chrome.storage.local` only. Persist only:

- schema version;
- global default profile ID (initially `default`);
- per-origin profile ID (scheme + host + effective port; never path, query, or title);
- minimal UI preferences.

The browser owns permission grants; stored settings are never proof of permission. Recheck permission at startup/display with the equivalent of `chrome.permissions.contains()`. When deleting a site setting, offer to revoke an otherwise-unused origin permission through a user action. Incognito behavior is not guaranteed by default. Do not store synced data, browsing history, access times, or page content.
