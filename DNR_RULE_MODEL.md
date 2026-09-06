# DNR Dynamic Rule Model / DNR dynamic ruleモデル

## Phase 5 implementation contract (English primary)

### Phase 6 runtime connection

One reconciler is reused by module initialization, install, browser startup, committed mutations, recovery, explicit refresh, and permission removal. No entry point constructs rules independently. The exact-host filter remains `|http*://<canonical-host>^`; tests admit HTTP/HTTPS paths and ports and reject subdomains, `host.evil.example`, `evil.host`, and non-HTTP schemes. Separate per-scheme rules would duplicate the same action without narrowing this anchored host boundary.

### Phase 6 runtime接続

module初期化、install、browser startup、commit mutation、recovery、明示refresh、permission removeは同一reconcilerを再利用し、各入口でruleを独自生成しない。exact-host filterは`|http*://<canonical-host>^`を維持する。testはHTTP/HTTPSのpathとportを許可し、subdomain、`host.evil.example`、`evil.host`、HTTP以外のschemeを拒否する。scheme別ruleはanchor済みhost境界を狭めず同じactionを重複させるため採用しない。

Phase 5 derives all product dynamic rules from validated storage plus current permission inspection. Each fully granted Desktop/Mobile host produces one rule with its persisted positive ID, priority `1`, `modifyHeaders`, exactly one request-header `set` for `User-Agent`, and `resourceTypes: ["main_frame"]`. Desktop and Mobile use the bundled Chrome 152 Verified Profile Set. Default, Global OFF, and missing/partial permission produce no rule; permission issues remain deterministic warnings and do not suppress unrelated valid hosts.

The exact-host condition is the non-regex `urlFilter` `|http*://hostname^`. The leading `|` anchors the URL start, `http*` covers HTTP and HTTPS under the granted capability, and `^` requires a URL separator after the canonical hostname, including `/` or `:` for a port. It therefore excludes sibling/superstring/subdomain hosts. There is no `regexFilter`, wildcard subdomain, redirect, response-header mutation, UA-CH mutation, or subresource scope. A pure diagnostic matcher locks the intended HTTP/HTTPS exact-host boundary in tests; actual Chrome matching remains a Level 2 integration assertion.

Rule IDs are allocated monotonically from `nextRuleId`, retain existing host IDs, never compact after deletion, and fail before overflow. The API schema defines IDs as signed IDL `long` values that must be at least `1`, so the implemented maximum is `2,147,483,647`. `modifyHeaders` is an unsafe-rule action; expected generation enforces the documented unsafe dynamic-rule ceiling of `5,000`. This is a technical ceiling, not a product capacity promise.

`getDynamicRules()` returns dynamic rules belonging to the calling extension, so every returned dynamic rule is MDPS-owned under this MVP, which creates no other dynamic-rule subsystem. Reconciliation deterministically diffs expected and actual rules by ID and canonical content, atomically removes then adds changed rules, rereads, and requires exact post-condition equality. Same-ID content changes are remove-plus-add; ordering alone is ignored.

The injected DNR adapter only normalizes `getDynamicRules` and `updateDynamicRules` API failures. The reconciler implements the Phase 3 derived-state port: `apply` and `rollback` both regenerate from the supplied validated state and current permission inspection; `failClosed` removes every extension dynamic rule and verifies zero. Failure to delete or verify zero is `dnr_fail_closed_failure`. No permission request occurs in this layer.

Official specification references: [Chrome DNR API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) and [Chromium DNR IDL](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/extensions/common/api/declarative_net_request.idl).

## Phase 5実装契約（日本語補足）

Phase 5は検証済みstorageと現在permission inspectionから製品dynamic rule全件を導出する。fully grantedなDesktop/Mobile hostごとに、保存済み正整数ID、priority `1`、`modifyHeaders`、`User-Agent`を`set`するrequest header 1件、`resourceTypes: ["main_frame"]`だけを持つruleを1本生成する。Desktop/Mobileは同梱Chrome 152 Verified Profile Setを使う。Default、Global OFF、permission missing/partialはruleなしで、permission問題はdeterministic warningとして残し、他の正常hostを抑止しない。

exact-host conditionはregexではない`urlFilter`の`|http*://hostname^`とする。先頭`|`でURL開始をanchorし、grant対象内のHTTP/HTTPSを`http*`で表し、`^`でcanonical hostname直後に`/`またはport用`:`等のseparatorを要求する。sibling、superstring、subdomain hostを含めない。`regexFilter`、wildcard subdomain、redirect、response header、UA-CH、subresourceは存在しない。pure diagnostic matcherで意図する境界をtest固定し、実Chrome matcherはLevel 2で確認する。

rule IDは`nextRuleId`から単調割当し、既存host IDを維持し、削除後も詰めず、overflow前に失敗する。API schemaのIDは1以上のsigned IDL `long`なので上限を`2,147,483,647`とする。`modifyHeaders`はunsafe ruleであるため、期待rule生成は公式unsafe dynamic rule上限`5,000`も検査する。これは技術上限であり製品capacity保証ではない。

`getDynamicRules()`は呼出Extension自身のdynamic rulesを返す。MVPには他のdynamic-rule subsystemがないため、その全件をMDPS-ownedとして扱う。reconcileはexpected/actualをIDとcanonical contentでdeterministic diffし、変更をatomic remove/addし、再readして完全一致を必須とする。同一IDの内容差はremove＋add、順序差だけはno-opである。

注入DNR adapterは`getDynamicRules`と`updateDynamicRules`のAPI failureだけを正規化する。reconcilerはPhase 3 derived-state portを実装し、`apply`/`rollback`は渡された検証済みstateと現在permissionから再生成し、`failClosed`はExtension dynamic rule全件を削除して0件を確認する。削除または0件確認失敗は`dnr_fail_closed_failure`であり、このlayerからpermission requestは行わない。

## 日本語

### Rule生成

DNRはstorageから生成する派生状態でありsource of truthではない。Global EnabledがONで、profileが`desktop`または`mobile`で、該当hostのHTTP/HTTPS permissionを確認できた場合にだけ、**hostごとに1本**のdynamic ruleを生成する。DNR conditionは複数の独立URL filterをOR配列で持たないため、1 rule/hostは生成・削除・診断・失敗host特定が最も単純である。

各ruleは次に固定する。

- condition: 正規化hostと任意portのHTTP/HTTPS URLに完全一致するanchored `urlFilter`
- `resourceTypes: ["main_frame"]`
- action: `modifyHeaders`
- requestHeaders: Profile SetのDesktopまたはMobile `User-Agent`に対する`set` 1件だけ
- priority: 全ruleで同じ固定値
- 対象: 全path。redirect、UA-CH、subresource、viewport、JavaScript identityは変更しない

hostnameはPhase 2のcanonical ASCII/IDNA値だけを使い、`|http*://example.com^`の形でURL開始とhostname後separatorをanchorする。`www.example.com`や`badexample.com`を含めず、wildcard/任意regexをruleへ渡さない。

### Rule ID

host entryの`ruleId`をstable positive integerとしてstorageに保存する。`nextRuleId`から単調増加で割り当て、削除後も再利用しない。同じhostのprofile変更、Global OFF/ON、service worker再起動、Extension updateでIDを維持する。上限接近時は新規追加を拒否して明示errorとし、暗黙のrenumberはしない。将来migrationでrenumberが必要ならschema migrationとしてatomicに行う。

### Reconciliation

起動、install/update、storage transaction完了、permission変更検出、Global ON時にreconcileする。

Phase 3で定義した`derivedState` portへ、Phase 5のDNR reconcilerを接続した。`apply`、`rollback`、`failClosed`は同じreconcile境界を利用し、Chrome API object自体はadapterへ注入する。

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

### Testability

desired rule生成とactual/desired diffはChrome APIから分離したpure functionとし、Level 1で全invariantをsnapshot比較する。Chrome adapterはLevel 2でactual `getDynamicRules()`/`updateDynamicRules()`と照合する。wire header確認は初回PC smokeでProfileごとに1回だけ行い、毎回の手動確認にはしない。詳細は`ACCEPTANCE_TEST_STRATEGY.md`を正とする。

## English

### Rule generation

DNR is derived from storage and is never the source of truth. Generate **one dynamic rule per host** only when Global Enabled is ON, the profile is `desktop` or `mobile`, and both HTTP/HTTPS permission checks for that host pass. A DNR condition has no array of independent URL filters to OR together; one rule per host is simplest to create, delete, diagnose, and attribute on failure.

Every rule is fixed to: an anchored non-regex `urlFilter` matching the normalized host over HTTP/HTTPS with any port; `resourceTypes: ["main_frame"]`; `modifyHeaders`; exactly one `set` operation for the Desktop or Mobile `User-Agent` from the Profile Set; and one common priority. It applies to every path and never changes redirects, UA-CH, subresources, viewport, or JavaScript identity.

Use only Phase 2 canonical ASCII/IDNA hostnames and enforce the boundary as `|http*://example.com^`, anchoring the URL start and the separator after the hostname. It excludes `www.example.com` and `badexample.com`; never pass a user wildcard or arbitrary regex into a rule.

### Rule ID

Persist each host entry's `ruleId` as a stable positive integer. Allocate monotonically from `nextRuleId` and never reuse a deleted ID. Keep the ID across profile changes, Global OFF/ON, service-worker restarts, and extension updates. Reject additions with an explicit error near the supported upper bound; do not silently renumber. A future required renumber is an atomic schema migration.

### Reconciliation

Reconcile on startup, install/update, successful storage transaction, detected permission change, and Global ON: validate schema/storage; inspect actual browser permissions; purely derive the desired set; read actual dynamic rules; replace them with one `updateDynamicRules({removeRuleIds, addRules})` call; then reread and verify IDs, conditions, and header values.

Phase 5 connects its DNR reconciler to the `derivedState` port defined in Phase 3. `apply`, `rollback`, and `failClosed` share the same reconciliation boundary, while the Chrome API object itself is injected into the adapter.

Global OFF removes every actual dynamic rule while preserving storage and permissions. Global ON regenerates from storage. Default hosts, permission-missing hosts, and invalid schemas generate no rule. Because the MVP creates only dynamic rules, all dynamic rules owned by this extension are managed. Product MVP uses no static or session rules.

### Failure

If a DNR update fails, best-effort restore the previous desired set. If state cannot be verified or rollback fails, remove all dynamic rules to fail closed, retain storage, surface `reconcile_required`, and retry from storage at startup, UI open, or explicit user retry. Never import actual DNR state back into storage.

Check rule-count limits, regex support, and header capability before generation. If limits would be exceeded, do not commit the storage mutation and ask the user to reduce the Site/host count.

### Testability

Keep desired-rule generation and actual/desired diff as pure functions separated from Chrome APIs, and snapshot every invariant at Level 1. At Level 2, compare the Chrome adapter against actual `getDynamicRules()`/`updateDynamicRules()`. Inspect wire headers only once per Profile in the initial PC smoke, not as a repeated manual check. `ACCEPTANCE_TEST_STRATEGY.md` is authoritative.
