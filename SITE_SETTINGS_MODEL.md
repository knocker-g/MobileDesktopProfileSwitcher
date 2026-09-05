# Site Settings Model / site 設定モデル

## 日本語

保存先は `chrome.storage.local` のみ。保存対象は次の最小情報とする。

- schema version
- global default profile ID（初期値 `default`）
- origin 単位の profile ID（scheme + host + effective port。path、query、title は保存しない）
- UI preference の最小値

permission grant 自体は browser が管理し、保存データを permission の根拠にしない。起動時・表示時に `chrome.permissions.contains()` 相当で再確認する。site 設定削除時は origin に他用途がなければ permission revoke を提案し、ユーザー操作で実行する。incognito は既定で別途保証しない。storage sync、外部 DB、閲覧履歴、アクセス時刻、ページ内容は保存しない。

### 複数hostを持つSite設定

1つのSite設定は1つ以上の明示的host/originと1つのprofile IDを束ねられる。YouTubeの第一候補は`www.youtube.com`と`m.youtube.com`であり、wildcard subdomainは使わない。各hostへのtop-level access時に保存profileを自動適用し、毎回の手動切替を要求しない。path、query、video ID、title、閲覧履歴は保存しない。

将来の製品は、ユーザーがSiteへ明示的に追加したhostごとにoptional host permissionを要求する。`<all_urls>`、無制限wildcard、保存設定だけを根拠にした権限利用は行わない。

## English

Use `chrome.storage.local` only. Persist only:

- schema version;
- global default profile ID (initially `default`);
- per-origin profile ID (scheme + host + effective port; never path, query, or title);
- minimal UI preferences.

The browser owns permission grants; stored settings are never proof of permission. Recheck permission at startup/display with the equivalent of `chrome.permissions.contains()`. When deleting a site setting, offer to revoke an otherwise-unused origin permission through a user action. Incognito behavior is not guaranteed by default. Do not store synced data, browsing history, access times, or page content.

### Multi-host Site setting

One Site setting may group one or more explicit hosts/origins under one profile ID. The first YouTube candidate groups `www.youtube.com` and `m.youtube.com` without a wildcard subdomain. Automatically apply the saved profile on top-level access to each host instead of requiring repeated manual selection. Never store paths, queries, video IDs, titles, or browsing history.

The future product requests optional host permission only for each host explicitly added by the user. Do not use `<all_urls>`, unrestricted wildcards, or stored settings as proof of a permission grant.
