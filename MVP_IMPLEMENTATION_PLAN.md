# MVP Implementation Plan / MVP実装計画

## 日本語

### 目的と固定境界

本書は製品MVPを小さくレビュー可能なcommitへ分割する。製品identityは`Default`、`Desktop`、`Mobile`で、Desktop/Mobileは同一milestoneの検証済みProfile Setを使う。変更対象は明示hostの`main_frame`に対する`User-Agent`だけである。UA-CH、JavaScript/Worker identity、viewport、subresource、redirect、URL rewrite、remote configurationは扱わない。

実装はChrome非依存のpure coreと薄いChrome API adapterを分離する。storageが唯一のsource of truthであり、permissionは実ブラウザ状態、DNR dynamic ruleはstorageから再生成できる派生状態とする。各Phaseは、記載した自動確認が通る独立commitを境界とし、後続Phaseを戻さずrevertできる粒度を保つ。

製品ManifestのAPI permissionは`storage`、`declarativeNetRequestWithHostAccess`、現在host prefillだけに使う`activeTab`とする。`optional_host_permissions`は`http://*/*`と`https://*/*`をcapability envelopeとして宣言するが、実際のrequestは登録するexact hostのHTTP/HTTPS originだけである。`tabs`、`scripting`、`webRequest`、`cookies`、`debugger`、install-time host permissionは追加しない。Siteは複数の明示hostと1 profileを持ち、cross-Site duplicateとwildcardを禁止する。Defaultも保存するがruleは生成しない。

### Phase計画

| Phase | 実装対象 | 自動確認 | 人間確認 | commit境界・rollback |
|---|---|---|---|---|
| 1. Skeleton / Profile Set | MV3 manifest、製品directory、zero-dependency test command、Profile Set定義、profile enum | manifest/syntax、Desktop/Mobile milestone一致、UA形式、Default無変更 | なし | skeletonだけのcommit。機能ruleなしなので単独revert可能 |
| 2. Domain model | host正規化、Site/settings validation、duplicate検出、stable Site/rule ID割当、schema migration入口 | valid/invalid/table-driven unit test、schema mismatch fail closed | なし | pure coreだけをcommit |
| 3. Storage / transaction core | revision、pending mutation journal、desired-state transaction、recovery decision | fake adapterでwrite failure、stale revision、crash位置、rollback/recovery | なし | Chrome side effect前のtransaction coreとしてcommit |
| 4. Permission adapter | exact HTTP/HTTPS request/contains/remove、追加・編集・削除lifecycle | adapter contract test、request payload検査、denial/partial/missing permission | promptだけLevel 2/3へ集約 | permission境界だけのcommit。PC PoC `96ece2f`を根拠にする |
| 5. DNR / reconcile | hostごと1 dynamic rule、rule diff、Global ON/OFF、startup/update/UI-open reconcile、fail closed | rule snapshot、main_frame/UA-only invariant、permission不足、edit/delete/OFF/ON、failure injection | なし | UIなしのengine commit。storageから常に復元可能 |
| 6. Settings UI | responsive Site list/CRUD、Profile、Global toggle、permission/error/health表示 | DOM/controller test、keyboard/accessibility/static checks、adapter fake scenario | 原則なし | engine APIだけに依存するUI commit |
| 7. Action / current host | `activeTab`によるHTTP(S) hostname prefill、既存Site表示、settings導線 | URLを保存しないこと、unsupported URL、activeTab adapter contract | Level 3へ集約 | popup/prefillだけのcommit。`tabs`は追加しない |
| 8. PC acceptance runner | test専用runner、actual storage/permission/DNR API一括検証、JSON summary、state cleanup | runner self-check、期待rule照合、結果schema | 1回のpermission promptだけ | production package/permissionと分離したtest tooling commit |
| 9. Hardening / release candidate | recovery、permission revoke、rule limit、migration、privacy/CWS checklist、package除外確認 | `npm run verify`、fault matrix、package audit | PC consolidated smoke 1回 | release-candidate commit。失敗時Phase単位でrevert |
| 10. Android final gate | 製品版をQuettaへloadしPCで保証できない差分だけ確認 | 事前に全Level 1/2をPASS | Android/Quetta final smoke 1回 | 結果文書を独立commitし、失敗時は製品commitを改変せず原因Phaseへ戻る |

初期製品Profile Set milestoneはChrome 152に決定し、Desktop/Mobile Reduced UAを同一milestoneでPhase 1に実装した。過去のfixtureは流用しない。各Phaseで新たな手動確認を要求せず、Chrome実APIはPhase 8、目視機能はPhase 9/10へまとめる。重大なAPI差が早期に見つかった場合だけ例外とし、理由、最小操作、期待値、停止条件を提示する。

### Repository / test構造案

```text
src/
  core/       profile set, normalization, validation, rule generation/diff, recovery decisions
  adapters/   permissions, storage, DNR, activeTab
  ui/         settings/action controllers and views
test/
  unit/       Node built-in test runner
  contract/   Chrome adapter fakes and invariant checks
  fixtures/   non-secret deterministic settings/rules
investigation/
  ...         research-only probes; never imported by product code
```

導入時の標準commandは`npm run verify`とし、外部test frameworkを追加せずNode標準`node:test`、manifest parse、全製品JavaScript syntax、unit/contract test、禁止permission/pattern検査、`git diff --check`を1回で実行する。`package.json`はscript定義のためだけにPhase 1で追加できるが、runtime/dev dependencyは持たせない。

### Gateと未確定事項

- Phase 1 gate: Chrome 152のDesktop/Mobile Reduced UAと自動検証を実装済み。real-browser functional acceptanceはPhase 8〜10で行う。
- Phase 2 gate: DNS/IDN host正規化、Site/profile/ID/rule ID validation、collection duplicate検出、immutable add/update/removeをpure coreとして実装済み。ID生成、schema migration、transactionは後続Phaseに残す。
- Phase 3 gate: schema/revision/journal、直列mutation、stale拒否、rollback、startup recovery、fail-closed decisionをChrome非依存coreとfake portで実装済み。Chrome storage adapter、permission、DNRは後続Phaseに残す。
- Phase 4 gate: exact HTTP/HTTPS permission plan、full/partial/none inspection、user-gesture-first request、post-condition、release、external revoke inspection、注入可能Chrome adapterを実装済み。storage transaction接続、service worker、DNR、UIは後続Phaseに残す。
- Phase 5 gate: stable rule ID allocation、main-frame UA-only expected rule、extension-owned diff、atomic reconcile/read-back、fail closed、DNR adapterとPhase 3 transaction統合を実装済み。service workerとUIは後続Phaseに残す。
- Phase 5 gate: dynamic-rule上限、rule ID上限、regex supportを実環境値と照合する。
- Phase 8 gate: PC Chromeでactual storage/permission/DNR lifecycleが一括PASSする。
- Phase 9 gate: PC manual smokeと一度限りのmain-frame wire確認。
- Phase 10 gate: Quettaでexact permission、Desktop/native viewport、Default復帰、Site削除後のpermission解放を確認する。これにより単独Permission Probeと同等以上なら、その単独試験を省略する。
- CWS提出、一般site compatibility、Profile Set更新周期はMVPコード完成後のrelease gateであり、本計画では実装しない。

## English

### Phase 6 runtime implementation note

Phase 6 adds the module service worker, a single-key Chrome storage adapter, startup recovery, serialized Site/profile/global mutations, post-commit permission release, permission-revoke reconciliation, and an allowlisted message boundary. Permission acquisition remains a direct future-UI user-gesture operation and is never initiated by the backend. Settings and action UI remain unimplemented.

### Phase 6 runtime実装注記

Phase 6ではmodule service worker、単一keyのChrome storage adapter、startup recovery、直列化されたSite/profile/global mutation、commit後permission release、permission revoke時reconcile、allowlist方式のmessage境界を追加する。permission取得は将来UIの直接user gesture操作として残し、backendから開始しない。settings/action UIは未実装である。

### Objective and fixed boundary

This document divides the product MVP into small, reviewable commits. Product identities are `Default`, `Desktop`, and `Mobile`; Desktop and Mobile use one Verified Profile Set at the same milestone. The only mutation is `User-Agent` on `main_frame` for explicit hosts. UA-CH, JavaScript/Worker identity, viewport, subresources, redirects, URL rewriting, and remote configuration remain out of scope.

Separate a Chrome-independent pure core from thin Chrome API adapters. Storage is the sole source of truth, permissions are actual browser state, and DNR dynamic rules are derived state that can always be regenerated from storage. Each phase ends in an independent commit after its listed automated checks pass and remains small enough to revert without undoing later unrelated work.

The product manifest uses only `storage`, `declarativeNetRequestWithHostAccess`, and `activeTab` limited to current-host prefill. `optional_host_permissions` declares `http://*/*` and `https://*/*` only as the capability envelope; each runtime request contains only the exact host's HTTP/HTTPS origins. Do not add `tabs`, `scripting`, `webRequest`, `cookies`, `debugger`, or install-time host permission. A Site has multiple explicit hosts and one profile; cross-Site duplicates and wildcards are rejected. Default is persisted but generates no rule.

### Phase plan

| Phase | Implementation | Automated verification | Human verification | Commit boundary and rollback |
|---|---|---|---|---|
| 1. Skeleton / Profile Set | MV3 manifest, product directory, zero-dependency test command, Profile Set, profile enum | manifest/syntax, matching milestones, UA form, Default unchanged | None | Skeleton-only commit with no functional rule; independently revertible |
| 2. Domain model | host normalization, Site/settings validation, duplicate rejection, stable Site/rule IDs, migration entry | table-driven valid/invalid tests and schema-mismatch fail closed | None | Pure-core-only commit |
| 3. Storage / transaction core | revision, pending journal, desired-state transaction, recovery decisions | fake-adapter tests for write failure, stale revision, crash points, rollback/recovery | None | Transaction-core commit before Chrome side effects |
| 4. Permission adapter | exact HTTP/HTTPS request/contains/remove and create/edit/delete lifecycle | adapter contracts, request-payload checks, denial/partial/missing permission | Prompt only, consolidated into Level 2/3 | Permission-boundary commit using PC PoC `96ece2f` as evidence |
| 5. DNR / reconcile | one dynamic rule per host, rule diff, Global ON/OFF, startup/update/UI-open reconcile, fail closed | snapshots and invariants for main-frame UA-only, missing permission, edit/delete/OFF/ON, injected failures | None | UI-free engine commit; always recoverable from storage |
| 6. Settings UI | responsive Site CRUD, Profile, Global toggle, permission/error/health display | DOM/controller, keyboard/accessibility/static checks with fake adapters | Normally none | UI commit depending only on the engine API |
| 7. Action / current host | `activeTab` HTTP(S)-hostname prefill, existing-Site state, settings route | no URL persistence, unsupported URL, activeTab adapter contract | Consolidated into Level 3 | Popup/prefill-only commit; no `tabs` permission |
| 8. PC acceptance runner | test-only runner for actual storage/permission/DNR APIs, JSON summary, cleanup | runner self-check, expected-rule comparison, result schema | One permission prompt only | Test-tooling commit separated from production package/permissions |
| 9. Hardening / release candidate | recovery, permission revoke, rule limit, migration, privacy/CWS checklist, package audit | `npm run verify`, fault matrix, package audit | One consolidated PC smoke | Release-candidate commit; revert by Phase if needed |
| 10. Android final gate | load product build in Quetta and inspect only gaps PC cannot prove | All Level 1/2 checks pass first | One Android/Quetta final smoke | Separate results commit; on failure return to the responsible Phase without rewriting product history |

The initial product Profile Set is Chrome 152, and Phase 1 implements both Desktop and Mobile Reduced UAs at that milestone without promoting prior fixtures. Do not request incremental manual checks during implementation. Consolidate real Chrome API testing in Phase 8 and visual behavior in Phases 9/10. An early exception requires evidence of an API-specific blocker plus a stated reason, minimum operations, expected result, and stop condition.

### Proposed repository and test structure

The directory proposal shown in Japanese applies identically. `src/core` contains the Profile Set, normalization, validation, rule generation/diff, and recovery decisions; `src/adapters` contains permissions, storage, DNR, and activeTab boundaries; `src/ui` contains controllers/views; `test/unit` and `test/contract` use deterministic, non-secret fixtures. Investigation probes are never imported by product code.

Once Phase 1 starts, the canonical command is `npm run verify`. With no external test framework, it runs Node's built-in `node:test`, manifest parsing, syntax checks for all product JavaScript, unit/contract tests, forbidden-permission/pattern checks, and `git diff --check`. Phase 1 may add `package.json` only for scripts; it has no runtime or development dependencies.

### Gates and open items

- Phase 1: Chrome 152 Desktop/Mobile Reduced UAs and their automated validation are implemented; real-browser functional acceptance remains in Phases 8–10.
- Phase 2: DNS/IDN normalization, Site/profile/ID/rule-ID validation, collection duplicate detection, and immutable add/update/remove are implemented in the pure core. ID generation, schema migration, and transactions remain for later phases.
- Phase 3: schema/revision/journal handling, serialized mutations, stale rejection, rollback, startup recovery, and fail-closed decisions are implemented with Chrome-independent core and fake ports. Chrome storage, permission, and DNR adapters remain for later phases.
- Phase 4: exact HTTP/HTTPS permission planning, full/partial/absent inspection, user-gesture-first request, post-condition checks, release, external-revoke inspection, and an injectable Chrome adapter are implemented. Storage-transaction orchestration, service worker, DNR, and UI remain for later phases.
- Phase 5: stable rule-ID allocation, main-frame UA-only expected rules, extension-owned diffing, atomic reconciliation/read-back, fail closed, a DNR adapter, and Phase 3 transaction integration are implemented. Service-worker and UI orchestration remain for later phases.
- Phase 5: verify dynamic-rule and rule-ID limits plus regex support against target environments.
- Phase 8: pass actual storage/permission/DNR lifecycle in PC Chrome in one run.
- Phase 9: pass one PC manual smoke and one-time main-frame wire verification.
- Phase 10: confirm exact permission, Desktop/native viewport, Default restoration, and permission release after Site deletion on Quetta. The standalone Permission Probe may be omitted when this is equal or stronger.
- CWS submission, general-site compatibility, and the Profile Set maintenance interval are post-code release gates, not implementation in this plan.
