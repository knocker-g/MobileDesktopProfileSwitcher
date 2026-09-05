# DNR Dynamic Rule Model / DNR dynamic ruleモデル

## 日本語

### Rule生成

DNRはstorageから生成する派生状態でありsource of truthではない。Global EnabledがONで、profileが`desktop`または`mobile`で、該当hostのHTTP/HTTPS permissionを確認できた場合にだけ、**hostごとに1本**のdynamic ruleを生成する。DNR conditionは複数の独立URL filterをOR配列で持たないため、1 rule/hostは生成・削除・診断・失敗host特定が最も単純である。

各ruleは次に固定する。

- condition: 正規化hostと任意portのHTTP/HTTPS URLに完全一致するanchored `regexFilter`
- `resourceTypes: ["main_frame"]`
- action: `modifyHeaders`
- requestHeaders: Profile SetのDesktopまたはMobile `User-Agent`に対する`set` 1件だけ
- priority: 全ruleで同じ固定値
- 対象: 全path。redirect、UA-CH、subresource、viewport、JavaScript identityは変更しない

hostnameはregex metacharacterをescapeし、subdomain境界を曖昧にしない。例えば`example.com`は概念上`^https?://example\.com(?::[0-9]+)?/`へ変換し、`www.example.com`や`badexample.com`を含めない。wildcard/任意regexをユーザー入力からruleへ渡さない。

### Rule ID

host entryの`ruleId`をstable positive integerとしてstorageに保存する。`nextRuleId`から単調増加で割り当て、削除後も再利用しない。同じhostのprofile変更、Global OFF/ON、service worker再起動、Extension updateでIDを維持する。上限接近時は新規追加を拒否して明示errorとし、暗黙のrenumberはしない。将来migrationでrenumberが必要ならschema migrationとしてatomicに行う。

### Reconciliation

起動、install/update、storage transaction完了、permission変更検出、Global ON時にreconcileする。

1. schemaとstorageを検証する。
2. browserのactual permissionsを確認する。
3. enabled/profile/permissionからdesired rule setを純粋生成する。
4. `getDynamicRules()`でactual setを取得する。
5. 1回の`updateDynamicRules({removeRuleIds, addRules})`でMDPS dynamic rulesをdesired setへ置換する。
6. 再取得してID、condition、header値を照合する。

Global OFFではactual dynamic rule IDを全削除し、storageとpermissionを保持する。Global ONではstorageから再生成する。Default host、permission missing host、不正schemaからruleを作らない。MDPSはdynamic ruleしか作らないため、Extension自身のdynamic rule全件を管理対象とする。Static/session ruleは製品MVPで使用しない。

### Failure

DNR updateが失敗した場合は、old desired setへbest-effort rollbackする。確認不能またはrollback失敗時は全dynamic ruleを削除してfail closedとし、storageを保持して`reconcile_required`を表示する。次回startup/UI open/manual retryでstorageから再構築する。actual DNR stateをstorageへ逆輸入しない。

rule count limit、regex support、header変更能力は生成前に検査する。limit超過時はstorage mutationをcommitせず、ユーザーへSite/host数を減らすよう通知する。

## English

### Rule generation

DNR is derived from storage and is never the source of truth. Generate **one dynamic rule per host** only when Global Enabled is ON, the profile is `desktop` or `mobile`, and both HTTP/HTTPS permission checks for that host pass. A DNR condition has no array of independent URL filters to OR together; one rule per host is simplest to create, delete, diagnose, and attribute on failure.

Every rule is fixed to: an anchored `regexFilter` matching the normalized host over HTTP/HTTPS with any port; `resourceTypes: ["main_frame"]`; `modifyHeaders`; exactly one `set` operation for the Desktop or Mobile `User-Agent` from the Profile Set; and one common priority. It applies to every path and never changes redirects, UA-CH, subresources, viewport, or JavaScript identity.

Escape hostname regex metacharacters and enforce the host boundary. Conceptually, `example.com` becomes `^https?://example\.com(?::[0-9]+)?/`, which does not include `www.example.com` or `badexample.com`. Never pass user wildcard or arbitrary-regex input into a rule.

### Rule ID

Persist each host entry's `ruleId` as a stable positive integer. Allocate monotonically from `nextRuleId` and never reuse a deleted ID. Keep the ID across profile changes, Global OFF/ON, service-worker restarts, and extension updates. Reject additions with an explicit error near the supported upper bound; do not silently renumber. A future required renumber is an atomic schema migration.

### Reconciliation

Reconcile on startup, install/update, successful storage transaction, detected permission change, and Global ON: validate schema/storage; inspect actual browser permissions; purely derive the desired set; read actual dynamic rules; replace them with one `updateDynamicRules({removeRuleIds, addRules})` call; then reread and verify IDs, conditions, and header values.

Global OFF removes every actual dynamic rule while preserving storage and permissions. Global ON regenerates from storage. Default hosts, permission-missing hosts, and invalid schemas generate no rule. Because the MVP creates only dynamic rules, all dynamic rules owned by this extension are managed. Product MVP uses no static or session rules.

### Failure

If a DNR update fails, best-effort restore the previous desired set. If state cannot be verified or rollback fails, remove all dynamic rules to fail closed, retain storage, surface `reconcile_required`, and retry from storage at startup, UI open, or explicit user retry. Never import actual DNR state back into storage.

Check rule-count limits, regex support, and header capability before generation. If limits would be exceeded, do not commit the storage mutation and ask the user to reduce the Site/host count.
