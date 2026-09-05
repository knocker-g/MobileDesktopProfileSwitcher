# Storage and Transaction Model / Storage・transactionモデル

## 日本語

### Keysと正本

`chrome.storage.local`だけを使用する。`settings`が唯一のconfiguration source of truthで、`pendingMutation`はcrash recovery用journal、`health`は非秘密の診断状態である。DNRやpermission一覧を正本として保存しない。

- `settings`: `SITE_SETTINGS_MODEL.md`のschema。
- `pendingMutation`: `{ operationId, baseRevision, nextSettings }`。mutation中だけ存在する。
- `health`: `ok | permission_missing | permission_cleanup_required | reconcile_required | schema_unsupported`と最小error code。URLやpage contentを含めない。

### Transaction

create/edit/profile/global toggle/deleteは次の順序で行う。

全mutationはservice worker内の単一queueで直列化し、UIは読み込み時の`revision`をSaveへ渡す。処理開始時にrevisionが一致しなければ`stale_revision`として拒否し、最新設定を再表示する。これにより複数popup/settings contextのlost updateを防ぐ。

1. 現在の`settings`を読み、schema/revision/全fieldを検証する。
2. 入力を正規化し、duplicate、permission、rule limitをpreflightする。
3. 必要な新規permissionをuser gesture内で取得・再確認する。
4. `revision + 1`の`nextSettings`を作り、`pendingMutation`へ書く。ここでは正本を変えない。
5. `nextSettings`からdesired DNR setを生成し、atomicな`updateDynamicRules`で適用・再確認する。
6. DNR成功後、`settings = nextSettings`を1回のstorage writeでcommitする。
7. `pendingMutation`を削除し`health = ok`とする。
8. 削除対象permissionがあればcommit後にremoveする。失敗はcleanup warningとして再試行する。

step 4以前の失敗は設定を変更しない。DNR失敗時はold settings由来ruleへrollbackし、new permissionだけを解放する。DNR成功後のsettings write失敗またはservice worker停止ではjournalを残す。次回起動時はpersist済み`settings`を正とし、そのrevisionとjournalを比較してDNRをsettingsへ戻し、未commitの新規permissionをbest-effort解放してjournalを消す。settings commit後にjournal削除だけ失敗した場合はrevision一致を検出し、settingsからDNRを再確認してjournalを消す。

### Validation errorとschema

- permission拒否: old settings/rules維持、draft維持。
- storage write失敗: commitなし。DNRをold settingsへrollback。確認不能なら全rule削除して`reconcile_required`。
- DNR失敗: commitなし、old ruleへrollback。失敗時fail closed。
- 不正host/duplicate別Site/Site名空欄/hosts空/unknown profile: permission要求前に拒否。
- unsupported `schemaVersion`: migrationなしに解釈しない。全dynamic ruleを削除してfail closed、raw settingsを保持し`schema_unsupported`を表示する。ユーザー確認なしにresetしない。

起動、Extension update、UI openで必ずreconcileし、storage→permission確認→DNRの一方向で修復する。DNR actual stateをstorageへ反映しない。

### Testability

transactionの状態遷移、journal判定、rollback/recovery decisionはpure coreとし、storage/DNR/permissionをinjectable adapterにする。Level 1で各failure pointをfakeにより完全自動検査し、Level 2でactual `chrome.storage.local`とDNRのread-back/reconcileを一括確認する。実Extension reload後の復元だけをLevel 3の1回のmanual smokeへ残す。

Phase 2ではstorage非依存のSite collection validationとimmutable add/update/removeだけを実装した。これらはpersistやrevisionを変更せず、Phase 3 transaction coreがcommit candidateを作るために利用する。Phase 2 operationの結果をstorage成功と解釈してはならない。

### Phase 3実装契約

Phase 3のpure coreは、adapterが読み書きする論理aggregateを`{ schemaVersion, revision, enabled, nextRuleId, sites, pendingMutation }`として扱う。現在schemaは`1`、defaultはrevision `0`、enabled、空sites、nextRuleId `1`、journalなしである。生成・検証結果はdeep immutableで、default factoryは呼出しごとに新しい値を返す。将来の`chrome.storage.local` adapterはconfigurationとjournalを物理keyへ写像できるが、coreの原子的snapshot契約を守らなければならない。

journalは`mutationId`、`baseRevision`、`nextRevision`、`operationKind`、canonicalな`nextState`を持つ。`nextRevision`は必ず`baseRevision + 1`である。mutationは単一Promise queueで直列化し、読取revisionと`expectedRevision`が一致しなければwriteやderived apply前に`stale_revision`で拒否する。正常系は旧configuration＋journalの保存、derived state適用、next configuration＋journalの保存、journal clearの順で完了する。

derived applyまたはnext configuration保存が失敗した場合、old derived stateとold configurationへのrollbackを試みる。rollbackも失敗した場合は`rollback_failure`としてfail closedを要求し、残存raw state/journalを上書きしない。commit後のjournal clearだけが失敗した場合はnext revisionとjournalを残し、startupでcommit済みと判定できる。

startup decisionは、journalなしならcurrent configurationをreconcileし、current revisionがjournalのbaseならrollback、journalのnext revisionかつnextStateと一致すればcommit finalizationを行う。それ以外の関係、corrupt current schema、older/unknown/newer schemaはfail closedであり、raw stateを保存する。Phase 3はmigrationを実装せず、schema分類だけを提供する。

storage portは`readState()`/`writeState()`、derived-state portは`apply()`/`rollback()`/`failClosed()`の最小境界である。Phase 3ではin-memory fakeのみを実装し、Chrome API、DNR生成、permission、health永続化は実装しない。mutation IDは注入するが、Site ID生成とrule ID allocationは後続Phaseに残す。

## English

### Keys and authority

Use only `chrome.storage.local`. `settings` is the sole configuration source of truth; `pendingMutation` is a crash-recovery journal, and `health` is non-secret diagnostic state. Never persist DNR or permission listings as authority.

- `settings` uses the schema in `SITE_SETTINGS_MODEL.md`.
- `pendingMutation` is `{ operationId, baseRevision, nextSettings }` and exists only during mutation.
- `health` is `ok | permission_missing | permission_cleanup_required | reconcile_required | schema_unsupported` plus a minimal error code, never a URL or page content.

### Transaction

Create, edit, profile/global toggle, and delete follow the same order: validate current schema/revision and every field; normalize input and preflight duplicates, permission, and rule limits; obtain and verify new permission within a user gesture; journal `nextSettings` at `revision + 1` without changing authority; atomically apply and verify its desired DNR set; commit `settings = nextSettings` in one storage write; clear the journal and set health to `ok`; then remove obsolete permission after commit, retrying cleanup failures.

Serialize every mutation through one service-worker queue. The UI submits the `revision` it loaded; reject a mismatch as `stale_revision` and refresh the latest settings. This prevents lost updates from concurrent popup or settings contexts.

A failure before journaling changes nothing. A DNR failure restores rules derived from old settings and releases only newly obtained permission. If DNR succeeds but the settings write fails or the worker stops, retain the journal. At next startup, persisted `settings` remains authoritative: compare revisions, restore DNR from settings, best-effort release uncommitted new permission, and clear the journal. If settings committed but only journal removal failed, detect the matching revision, verify DNR from settings, and clear the journal.

### Validation errors and schema

- Permission denial preserves old settings/rules and the UI draft.
- Storage-write failure does not commit; restore old DNR, or remove all rules and mark `reconcile_required` if verification is impossible.
- DNR failure does not commit; restore old rules, failing closed if restoration fails.
- Invalid host, cross-Site duplicate, empty Site name, empty hosts, and unknown profile fail before requesting permission.
- An unsupported `schemaVersion` is never guessed or interpreted without migration. Remove all dynamic rules to fail closed, preserve raw settings, show `schema_unsupported`, and never reset without user confirmation.

Always reconcile at startup, extension update, and UI open in one direction: storage → permission verification → DNR. Never write actual DNR state back into storage.

### Testability

Keep transaction transitions, journal decisions, and rollback/recovery decisions in the pure core, with injectable storage/DNR/permission adapters. Level 1 uses fakes to cover every failure point, Level 2 performs one actual `chrome.storage.local` and DNR read-back/reconcile run, and only restoration after a real extension reload remains in the one Level 3 manual smoke.

Phase 2 implements only storage-independent Site-collection validation and immutable add/update/remove. They neither persist nor change a revision; the Phase 3 transaction core will use them to build commit candidates. Never interpret a Phase 2 operation result as a successful storage commit.

### Phase 3 implementation contract

The Phase 3 pure core treats the adapter snapshot as one logical aggregate: `{ schemaVersion, revision, enabled, nextRuleId, sites, pendingMutation }`. The current schema is `1`; its default is revision `0`, enabled, no Sites, next rule ID `1`, and no journal. Produced and validated values are deeply immutable, and the default factory returns a fresh value on every call. A future `chrome.storage.local` adapter may map configuration and journal to physical keys, but it must preserve the core's atomic-snapshot contract.

The journal contains `mutationId`, `baseRevision`, `nextRevision`, `operationKind`, and canonical `nextState`; `nextRevision` must equal `baseRevision + 1`. One Promise queue serializes mutations. A mismatch between the read revision and `expectedRevision` produces `stale_revision` before any write or derived apply. The successful sequence persists old configuration plus journal, applies derived state, persists next configuration plus journal, and clears the journal.

If derived apply or next-configuration persistence fails, the coordinator attempts to restore both old derived state and old configuration. If rollback also fails, it requests fail closed, returns `rollback_failure`, and does not overwrite the remaining raw state or journal. If only post-commit journal cleanup fails, the next revision and journal remain so startup can recognize a committed transaction.

At startup, no journal means reconcile current configuration; a current revision equal to the journal base means rollback; and a revision equal to the journal next revision with matching `nextState` means finalize the commit. Every other relation, a corrupt current schema, and an older/unknown/newer schema fail closed while preserving raw state. Phase 3 classifies schemas but implements no migration.

The storage port is the minimal `readState()`/`writeState()` boundary, and the derived-state port is `apply()`/`rollback()`/`failClosed()`. Phase 3 supplies in-memory fakes only; it does not implement Chrome APIs, DNR generation, permissions, or persisted health. Mutation ID creation is injected; Site ID generation and rule-ID allocation remain for later phases.
