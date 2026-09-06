# Site Settings Model / Site設定モデル

## 日本語

### 決定

MVPは`1 Site = 1 logical site + 1個以上の明示host + 1 profile`とする。同一Site内の全hostに同じ`Default`、`Desktop`、または`Mobile`を適用し、host別profileは持たない。同一hostを複数Siteへ登録することは禁止する。これにより適用profileは一意となり、DNR priorityによる競合解決を不要にする。

`Default`は正式な保存値である。Site名、host group、permissionを保ったままidentity変更だけを止められる。Default SiteからDNR ruleは生成しない。

### 保存schema

`chrome.storage.local`の正本は概念上次の形とする。

```json
{
  "schemaVersion": 1,
  "revision": 1,
  "enabled": true,
  "nextRuleId": 1,
  "sites": [
    {
      "id": "crypto.randomUUID() value",
      "name": "YouTube",
      "profile": "desktop",
      "hosts": [
        { "hostname": "www.youtube.com", "ruleId": 1 },
        { "hostname": "m.youtube.com", "ruleId": 2 }
      ]
    }
  ]
}
```

- `schemaVersion`: migration判定用の正整数。
- `revision`: transaction/reconciliation用の単調増加整数。
- `enabled`: Extension全体ON/OFF。初期値`true`。
- `nextRuleId`: installation内で単調増加し、削除後も再利用しない正整数。
- Site `id`: 作成時に`crypto.randomUUID()`で生成する不透明・不変ID。秘密情報ではない。
- `name`: trim後1〜80 Unicode code points。空欄不可。重複名は許可するが、host conflictは許可しない。
- `profile`: `default | desktop | mobile`以外を拒否する。
- `hosts`: 1件以上。表示順を維持する。各entryの`ruleId`はhost作成時に予約し、Default中も保持する。

UA文字列やProfile Set milestoneはSiteごとに保存しない。製品同梱Profile Setを参照する。Cookie、認証情報、path、query、fragment、title、閲覧時刻、page contentは保存しない。

### Host入力と正規化

入力はbare hostまたはHTTP(S) URLを受け付ける。URL入力ではscheme、port、userinfo、path、query、fragmentをSite keyへ含めず、hostnameだけを採用する。ただしuserinfoを含むURLは秘密情報の誤入力を避けるため拒否する。HTTP(S)以外のscheme、空host、不正なURL/hostname、wildcard文字、正規表現は拒否する。

正規化順序はtrim → URL parserによるhostname抽出/IDNA ASCII化 → ASCII lowercase → trailing dot除去 → 妥当性確認とする。path付きURLもhostへ縮約する。scheme/port単位の設定は作らず、1 host設定はHTTPとHTTPSの両方および全path/portへ同じprofileを適用する。permissionは正規化hostに対する`http://host/*`と`https://host/*`を要求する。

Phase 2の製品domain modelは、少なくとも2 labelを持つDNS hostnameだけをMVP対象とする。Unicode IDNとpunycodeはURL parserで同じASCII punycodeへ正規化して受け付ける。IPv4、IPv6、`localhost`、single-label intranet hostは、permission/rule境界を不用意に広げないため拒否する。完全なHTTP(S) URLに含まれるportは除去するが、schemeなしの`host:port`は曖昧入力として拒否する。trailing dotは1個だけ許容し、複数dotは拒否する。

security上、authorityにuserinfo、percent escape、wildcard、regex metacharacterを含む入力、およびprotocol-relative URLを拒否する。`https://example.com@evil.example/`は`example.com`としても`evil.example`としても採用しない。`https://evil.example/?host=example.com`はbrowser上の実hostである`evil.example`、`https://example.com.evil.example/`はその完全なhostnameを採用する。`example.com/path`は明示的にbare-host + pathとして`example.com`へ縮約する。

同一入力内のduplicateは1件へdeduplicateしてUIで通知する。既存Siteに属するhostは、同じSiteへの重複追加をno-op、別Siteへの追加をvalidation errorとし、競合Site名を表示する。移動は旧Siteから削除した後に新Siteへ追加する明示操作とする。

### Phase 2 domain API

`src/core/`はChrome APIに依存しない。`normalizeHostInput()`、duplicate通知用`normalizeHostInputs()`、`validateProfile()`、`validateSite()`、`validateSiteCollection()`、`addSiteCandidate()`、`updateSiteCandidate()`、`removeSiteCandidate()`を公開する。validated Siteではduplicateを黙って除去せずerrorにする。UI入力準備だけが`normalizeHostInputs()`のdeduplicate結果と通知対象を利用する。

Site IDは`crypto.randomUUID()`が生成するUUID v4形式を検証するが、Phase 2はIDを生成しない。Site名はtrim後1〜80 Unicode code pointsでcontrol characterを拒否する。host entryの`ruleId`は正のsafe integerで、collection全体で一意とし、update後も既存hostのIDを維持する。削除済みIDの非再利用と新規割当は`nextRuleId`を扱う後続transactionの責務である。operationは入力を変更せず、新しくdeep-frozenしたcanonical collectionを返す。storage transaction、permission、rule適用は行わない。

validation failureは単一の`DomainValidationError`とstable `code`で区別する。codeは`invalid_host`、`duplicate_host`、`empty_site_name`、`invalid_site_name`、`empty_hosts`、`unknown_profile`、`invalid_site_id`、`duplicate_site_id`、`invalid_rule_id`、`duplicate_rule_id`、`site_not_found`である。unknown profileもこのerrorを使い、`RangeError`との互換性を維持する。

### CRUD

- **追加**: name/profile/hostsを全検証し、全host permission取得後にのみSiteを作成する。一部許可のSiteは保存しない。
- **編集**: immutable `id`を維持する。追加hostのpermissionが拒否された場合、persist済みSite全体を変更せずdraftを残す。追加分だけ黙って落とすpartial saveはしない。削除host、name、profileを含む編集は1 transactionとしてcommitする。
- **host削除**: hostsを空にできない。最後のhostを除く操作はSite削除へ誘導する。commit後、削除hostのpermissionを解放する。
- **Site削除**: storageとDNRからSiteを削除した後、全host permissionを解放する。
- **Profile変更**: Defaultはruleなし、Desktop/Mobileは同一Profile SetのUA ruleを再生成する。Defaultでもpermissionを保持する。

### Source of truthと次フェーズ

storageの検証済みSite設定が唯一のsource of truthで、DNR ruleとpermission statusは派生状態である。permission grantはbrowserが管理するため、保存値だけをgrantの証拠にせず`chrome.permissions.contains()`で確認する。詳細なpermission transactionは`PERMISSION_LIFECYCLE.md`、rule構造は`DNR_RULE_MODEL.md`を正とする。

Phase 4ではcreate時の全host、edit時の追加hostだけをpermission acquisition planへ変換し、delete/edit後のcollection全体から不要hostをrelease planへ変換するpure logicを実装した。permission取得失敗はcandidate Siteをcommit可能にせず、既存Siteをそのまま維持するdecisionとなる。storage transactionとの接続はまだ行わない。

## English

### Decision

The MVP uses `one Site = one logical site + one or more explicit hosts + one profile`. Every host in a Site receives the same `Default`, `Desktop`, or `Mobile` profile; per-host profiles do not exist. A host cannot belong to multiple Sites. This makes the applied profile unique and removes any need for DNR-priority conflict resolution.

`Default` is a first-class persisted value. It preserves the Site name, host group, and permission while stopping identity modification. A Default Site generates no DNR rule.

### Persisted schema

The conceptual source-of-truth object in `chrome.storage.local` is the JSON structure shown in the Japanese section, with identical fields and values.

- `schemaVersion` is a positive integer used for migration decisions.
- `revision` is a monotonically increasing integer used by transactions and reconciliation.
- `enabled` is the extension-wide ON/OFF value and defaults to `true`.
- `nextRuleId` increases monotonically within an installation; deleted IDs are not reused.
- A Site `id` is an opaque immutable `crypto.randomUUID()` value created with the Site; it is not secret.
- `name` contains 1–80 Unicode code points after trimming. Empty names are invalid. Duplicate names are allowed, but host conflicts are not.
- `profile` rejects every value except `default | desktop | mobile`.
- `hosts` contains at least one entry and preserves display order. Each entry reserves its `ruleId` when created and keeps it while Default is selected.

Do not persist UA strings or the Profile Set milestone per Site; refer to the product-bundled Profile Set. Never store cookies, credentials, paths, queries, fragments, titles, visit times, or page content.

### Host input and normalization

Accept a bare host or an HTTP(S) URL. For a URL, omit scheme, port, user info, path, query, and fragment from the Site key and retain only the hostname. Reject a URL containing user info to avoid accidental secret input. Reject non-HTTP(S) schemes, empty hosts, invalid URLs/hostnames, wildcard characters, and regular expressions.

Normalize by trimming, extracting and IDNA-ASCII-serializing the hostname with the URL parser, converting ASCII to lowercase, removing a trailing dot, then validating. Collapse a URL with a path to its hostname. There is no scheme- or port-specific setting: one host setting applies the same profile to both HTTP and HTTPS and every path/port. Request `http://host/*` and `https://host/*` permission for the normalized host.

The Phase 2 product domain model limits the MVP to DNS hostnames with at least two labels. Unicode IDNs and punycode are accepted and canonicalized by the URL parser to the same ASCII punycode. IPv4, IPv6, `localhost`, and single-label intranet hosts are rejected to avoid silently widening permission/rule scope. A port in a complete HTTP(S) URL is discarded; scheme-less `host:port` is rejected as ambiguous. One trailing dot is accepted, while repeated trailing dots are rejected.

For security, reject authority text containing user info, percent escapes, wildcards, regex metacharacters, and protocol-relative URLs. Never interpret `https://example.com@evil.example/` as either `example.com` or an accepted `evil.example`. `https://evil.example/?host=example.com` resolves to its actual host `evil.example`; `https://example.com.evil.example/` retains that complete hostname. `example.com/path` is explicitly accepted as a bare host plus path and collapses to `example.com`.

Deduplicate repeated hosts within one input and notify the user. Re-adding a host to its current Site is a no-op. Adding a host owned by another Site is a validation error that identifies the conflicting Site. Moving a host is an explicit remove-from-old-then-add-to-new operation.

### Phase 2 domain API

`src/core/` is independent of Chrome APIs. It exports `normalizeHostInput()`, notification-oriented `normalizeHostInputs()`, `validateProfile()`, `validateSite()`, `validateSiteCollection()`, `addSiteCandidate()`, `updateSiteCandidate()`, and `removeSiteCandidate()`. A validated Site rejects rather than silently removes a duplicate. Only UI input preparation uses the deduplicated result and duplicate notification from `normalizeHostInputs()`.

Validate Site IDs as UUID v4 values intended to come from `crypto.randomUUID()`, but do not generate them in Phase 2. A Site name is 1–80 Unicode code points after trimming and rejects control characters. Every host entry has a positive safe-integer `ruleId`, unique across the collection and stable for an existing host during update. Non-reuse of deleted IDs and allocation of new IDs belong to the later transaction that owns `nextRuleId`. Operations do not mutate inputs and return newly canonicalized, deep-frozen collections. They perform no storage transaction, permission request, or rule application.

One `DomainValidationError` plus a stable `code` distinguishes `invalid_host`, `duplicate_host`, `empty_site_name`, `invalid_site_name`, `empty_hosts`, `unknown_profile`, `invalid_site_id`, `duplicate_site_id`, `invalid_rule_id`, `duplicate_rule_id`, and `site_not_found`. Unknown profiles use this error while preserving `RangeError` compatibility.

### CRUD

- **Create:** Validate the name, profile, and all hosts, then persist the Site only after every required host permission is granted. Never save a partially permitted Site.
- **Edit:** Preserve immutable `id`. If permission for an added host is denied, leave the entire persisted Site unchanged and keep the draft for correction. Do not silently partial-save everything except the denied additions. Commit added/removed hosts, name, and profile as one transaction.
- **Remove host:** A Site cannot have an empty host list. Removing its last host directs the user to delete the Site. After commit, release the removed host permission.
- **Delete Site:** Remove the Site from storage and DNR, then release all of its host permissions.
- **Change profile:** Default generates no rule; Desktop and Mobile regenerate the UA rule from the same Profile Set. Default retains permission.

### Source of truth and next phase

Validated Site settings in storage are the only source of truth; DNR rules and permission status are derived state. The browser owns permission grants, so stored data never proves a grant—verify it with `chrome.permissions.contains()`. `PERMISSION_LIFECYCLE.md` is authoritative for permission transactions, and `DNR_RULE_MODEL.md` is authoritative for rule structure.

Phase 4 implements pure planning that maps all create hosts and only added edit hosts to acquisition, then derives obsolete-host release from the complete post-edit/delete collection. Failed acquisition never makes the candidate Site committable and leaves the persisted Site unchanged. Connection to the storage transaction remains unimplemented.
