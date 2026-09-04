# Privacy Model / プライバシーモデル

## 日本語

外部 server、analytics、telemetry、account は持たない。閲覧履歴、Cookie、authentication data、page/form contents、account information を収集・送信しない。端末内の `chrome.storage.local` に保存するのは、ユーザーが記憶を選んだ origin と profile ID、global default、schema version、最小 UI preference のみ。path/query/title/visit time は保存しない。

origin は Web browsing activity に該当し得るため、ローカルのみでも UI と privacy disclosure に明記する。ユーザーは一覧確認、個別削除、全削除、host permission revoke ができる。uninstall 後の browser による削除挙動に依存しつつ、製品内 retention は「設定が削除されるまで」。network request の内容は DNR の declarative matching 以外で読み取らない。

## English

There is no external server, analytics, telemetry, or product account. The extension does not collect or transmit browsing history, cookies, authentication data, page/form contents, or account information. `chrome.storage.local` stores only user-remembered origins and profile IDs, global default, schema version, and minimal UI preferences. It never stores path, query, title, or visit time.

Because origins may qualify as browsing activity, disclose this local handling in the UI and privacy notice. Users can inspect, delete individually, delete all, and revoke host permissions. Product retention lasts until the setting is deleted, subject to browser uninstall behavior. The extension does not inspect request content beyond declarative DNR matching.
