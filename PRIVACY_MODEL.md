# Privacy Model / プライバシーモデル

## 日本語

外部server、analytics、telemetry、accountは持たない。閲覧履歴、Cookie、authentication data、page/form contents、account informationを収集・送信しない。端末内の`chrome.storage.local`に保存するのは、schema/revision、Global Enabled、Site ID/表示名/profile、正規化host、stable rule ID、transaction journal、最小health/UI stateだけとする。UA値は製品同梱でありremote configを使わない。path/query/fragment/port/title/visit timeは保存しない。

登録hostはWeb browsing activityに該当し得るため、ローカルのみでもUI、privacy policy、CWS data disclosureへ明記する。現在site導線は`activeTab`でuser gesture時のURLからhostnameだけを一時取得し、完全URLを保存しない。ユーザーはSite/host一覧、個別削除、全削除、permission解放を実行できる。製品内retentionは設定削除まで。network request内容はDNRのdeclarative matching以外で読み取らない。

## English

There is no external server, analytics, telemetry, or product account. The extension does not collect or transmit browsing history, cookies, authentication data, page/form contents, or account information. `chrome.storage.local` stores only schema/revision, Global Enabled, Site ID/display name/profile, normalized hosts, stable rule IDs, a transaction journal, and minimal health/UI state. UA values are bundled; there is no remote configuration. Never store path, query, fragment, port, title, or visit time.

Because registered hosts may qualify as browsing activity, disclose local handling in UI, privacy policy, and CWS data disclosures. The current-site flow uses `activeTab` to derive only a hostname transiently from the URL after a user gesture and does not store the full URL. Users can inspect Site/host lists, delete individually or all, and release permission. Product retention lasts until deletion. The extension does not inspect request content beyond declarative DNR matching.
