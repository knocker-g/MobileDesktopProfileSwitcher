# Acceptance Test Strategy / Acceptance test戦略

## 日本語

### 原則と結果語彙

静的に証明できるものは静的検査、pure logicはunit test、Chrome API境界はcontract/integration、表示・再生など人間にしか判断できないものだけmanual smokeとする。同じ事実を各levelで繰り返さない。自動結果は`PASS`/`FAIL`、browser promptや目視が必要なら`MANUAL`、環境条件不足は`INCONCLUSIVE`とし、未実施をPASSにしない。

### Level 1 — Static / Unit（完全自動）

Phase 1以降の標準入口を`npm run verify`とする。外部dependencyを使わず、Node標準`node:test`と小さな検査scriptだけで次を実行する。

- Manifest JSON parse、全JavaScript syntax、禁止permission/pattern、secret/telemetry/remote endpointの静的検査。
- host正規化: URL/hostname、lowercase、trailing dot、IDNA、scheme/path/query/fragment/port除外。wildcard、userinfo、不正scheme/hostを拒否。
- Site/settings: 空name/hosts、duplicate host、cross-Site duplicate、profile enum、schema/revision、stable Site/rule ID。
- Profile Set: Desktop/Mobileの同一milestone、Reduced UA定義、DefaultはUA変更なし、fixtureとproduct setの分離。
- DNR: hostごと1 rule、anchored exact-host、`main_frame`だけ、`modifyHeaders` + `User-Agent` `set` 1件だけ。UA-CH/subresource/wildcard/redirectなし。
- state: Global OFFは0 rule、ONはstorageから生成、Default/permission不足はruleなし、edit差分、delete削除、stable ID、idempotent reconcile。
- failure: schema mismatch fail closed、storage/DNR失敗rollback、journal recovery、permission cleanup warning、rule limit preflight。
- 最後に`git diff --check`。失敗時は非zeroで終了し、後続levelへ進まない。

同じpure functionをproductionとtestがimportし、テスト用コピーを作らない。Chrome globalをcoreへ直接渡さず、adapter interfaceをfakeで検証する。

Phase 2時点ではhost security case、IDN/punycode、Site/profile/ID/rule ID、Site内・Site間duplicate、immutable CRUDをNode unit testへ統合済みである。Chrome API testやmanual checkはまだ実行しない。

Phase 3ではdefault/clone safety、schema分類、Phase 2 Site validation再利用、journal整合、正常commit、stale revision、各write failure、derived apply/rollback failure、残存journalのstartup decision、fail closed、同時mutation直列化とlost update防止をin-memory fakeで自動検証する。Chrome APIや人間確認は含めない。

Phase 4ではexact origin生成、canonical host強制、4状態inspection、multi-host create、added-host-only edit、collection全体からのrelease、Default/Global OFF保持、request denial/rejection/post-condition/cleanup failure、remove failure/post-condition、external revokeをNode unit/contract testへ統合する。PC PoCの既存Observed PASSを根拠とし、新しいmanual testは要求しない。

Phase 5ではrule ID allocation/overflow、Desktop/Mobile/Default/OFF/missing permission、exact-host main-frame UA-only invariant、diff、stale cleanup、atomic update後read-back、API/post-condition failure、fail closed、Phase 3 apply/rollback/fail-closed接続をfake DNRで自動検証する。Chrome実matcherとwire UAは後続の集約PC Acceptanceまで手動確認しない。

### Level 2 — PC Chrome Integration Runner

production manifestへtest権限を追加せず、unpacked development packageにだけ含めるtest page/runnerを用いる。`Run PC Acceptance Test`の1回のuser gestureから、入力済みのexact fixture hostについてpermission requestを直ちに開始する。ユーザー操作はbrowser promptの許可1回だけで、そのcallback後は次を直列実行する。

1. baselineをsnapshotし、test namespace/stateをcleanにする。
2. exact HTTP/HTTPS permissionをrequestし、`contains()`で確認する。
3. Siteを作成し、actual `chrome.storage.local`をread-backする。
4. Desktop、Mobile、Defaultへ遷移し、各actual dynamic ruleを`getDynamicRules()`で照合する。
5. Global OFFで0件、ONでstorageから復元、reconcile再実行でidempotentを確認する。
6. Site編集とhost削除のrule差分、Site削除、permission removeを確認する。
7. permissionを`permissions.remove()`で外部欠落相当にし、reconcileが該当ruleを生成せず`permission_missing`を示すことを確認する。
8. test-only fault adapterでstorage/DNR failureのrollback/fail-closedを確認する。
9. runnerが作成したstate/rule/permissionだけをcleanupし、baselineを検証する。

画面とdownload/copy可能なJSONへ`PASS n/n`、`FAIL n`、`MANUAL n`、各step、error codeを表示する。hostname以外のURL、query、閲覧履歴、Cookie/Auth、page contentを記録しない。permission prompt拒否はFAILではなく`MANUAL: permission not granted`として安全停止し、設定/ruleを残さない。

Rule configurationの照合はactual DNR API stateを証明するがwire headerそのものは証明しない。actual wireはLevel 3で初回実装時に各Profile 1回だけ確認する。service worker再起動後の真の復元はrunner内のidempotent reconcileに加えLevel 3の一度のExtension reloadで確認し、runnerのために`debugger`、`webRequest`、`cookies`、`tabs`、広域host grantを追加しない。

### Level 3 — PC Manual Smoke（1回、必要なら再試験1回）

1つのまとまったsessionで行う。理由はpermission promptの範囲、実ページの表示/再生、Extension reloadだけはunit/API stateから完全には証明できないためである。

1. YouTube Site（`www.youtube.com`、`m.youtube.com`）を登録し、promptがそのexact hostsのHTTP/HTTPSだけで広域権限でないことを確認する。
2. Desktopを選びfresh/reloadでDesktop Webと動画再生を確認する。対応Live pageが利用できる場合だけNative Live Chatを確認する。
3. Mobileを選びMobile Webと動画再生を確認する。PC viewportは変更しない。
4. Defaultでnative UA/表示へ戻り、Global OFFでidentity変更が止まることを確認する。
5. 初回実装時だけDevToolsでDesktop main-frame UA、Mobile main-frame UA、Default native UAを各1回確認する。UA-CH/subresourceは毎回採取しない。
6. Global ONかつDesktopへ戻してからExtensionをreloadし、設定保持とstorage由来rule復元を確認する。確認後はDefaultまたはGlobal OFFへ戻す。

期待値から外れた時点で追加操作を止め、Profile、host、health error、runner JSON、該当main-frameだけを保存する。Cookie削除、login reset、広域権限追加、試行錯誤のheader追加は行わない。修正後の再試験が必要なら同じsession一式を最大1回追加する。

### Level 4 — Android / Quetta Final Smoke（最終1回）

Level 1/2とPC smokeがPASSしたrelease candidateだけを対象にする。PCで保証できないQuettaのExtension load、optional permission prompt、Android native viewport、実ページ挙動だけを確認する。

1. Quettaへunpacked release candidateをloadする。
2. YouTube Siteを登録し、exact-host permissionが成立することを確認する。
3. DesktopでDesktop Web、native narrow viewport、動画再生を確認する。利用可能なLive pageがあればNative Live Chatを確認する。
4. Defaultへ戻し、Mobile Web/native状態へ復帰することを確認する。
5. Global OFF/ONと設定保持を一往復だけ確認する。
6. Siteを削除し、exact HTTP/HTTPS permissionが解放されてNot grantedになることを製品診断表示で確認する。
7. main-frame UAのremote-debugging確認は、画面結果が不明瞭な場合または最初のrelease candidateで1回だけ行う。

この製品smokeがrequest/contains/remove/remove後contains、Profile適用、Default復帰を含むため、QuettaでPermission Lifecycle Probeを別途実行する必要はない。permission prompt拒否、Extension load error、rule非適用、viewport変化、再生不能、permission cleanup失敗のいずれかで停止し、PCで保証済み項目を端末上で繰り返し診断しない。

### Manual Test Budget

MVP完成までの予定は、PC integration runnerでprompt許可1回、PC manual smoke 1 session（修正時のみ追加1 session）、Android/Quetta final smoke 1 sessionである。各依頼には必ず、(1)自動化できない理由、(2)確認項目、(3)最小操作、(4)期待結果、(5)停止条件を添える。Phase途中の見た目確認やwire採取を小分けで依頼しない。

### Acceptance gate

- Level 1: 全自動check PASS、skipなし。
- Level 2: API lifecycle/reconcile PASS、promptだけMANUALとして実際に許可済み、cleanup PASS。
- Level 3: Desktop/Mobile/Default/Global OFF、再生、reload recovery PASS。初回wire 3点一致。
- Level 4: Quetta load、exact permission、Desktop/native viewport/playback、Default復帰、Site削除後permission解放 PASS。
- Chrome 152 Profile Setのreal-browser compatibility、一般site compatibility、CWS審査準備は別release gateであり、試験結果を推測しない。

## English

### Phase 6 automated coverage

Level 1 now covers single-key storage, initial state creation, raw preservation, restart recovery, synchronous lifecycle-listener registration, serialized CRUD/global mutations, permission preconditions and post-commit release, external-revoke reconciliation, strict message allowlisting, and arbitrary UA/DNR injection rejection. Existing transaction-to-DNR contracts continue to cover apply failure, rollback, and fail closed. Phase 6 adds no manual browser test.

### Phase 6自動検証範囲

Level 1は単一key storage、初期state生成、raw保持、restart recovery、lifecycle listener同期登録、直列CRUD/global mutation、permission事前条件とcommit後release、external revoke reconcile、厳格なmessage allowlist、任意UA/DNR注入拒否を検証する。既存transaction-to-DNR contractでapply失敗、rollback、fail closedも継続確認する。Phase 6ではmanual browser testを追加しない。

### Phase 7 automated coverage

Level 1 covers current-host normalization, registered/unregistered/unsupported views, Global OFF and permission-warning models, deterministic Other Sites, Add/Edit form initialization and validation, immutable host-row operations, direct exact-origin permission sequencing, active-tab adapter scope, English-only semantic markup, responsive CSS invariants, manifest popup linkage, and absence of custom identity controls. Actual layout and permission-prompt appearance remain consolidated into Phase 8 PC acceptance and the final Android gate.

### Phase 7自動検証範囲

Level 1はcurrent host正規化、登録済み/未登録/未対応view、Global OFFとpermission warning model、deterministicなOther Sites、Add/Edit form初期化とvalidation、immutable host row操作、exact-origin permission直接実行順、active-tab adapter範囲、英語のみのsemantic markup、responsive CSS invariant、Manifest popup接続、custom identity control不在を検証する。実layoutとpermission prompt表示はPhase 8 PC acceptanceと最終Android gateへ集約する。

### Principles and result vocabulary

Use static checks for statically provable properties, unit tests for pure logic, contract/integration tests for Chrome API boundaries, and manual smoke only for display or playback that requires human judgment. Do not repeat the same proof at every level. Automated outcomes are `PASS`/`FAIL`; browser prompts or visual judgment are `MANUAL`; missing environmental prerequisites are `INCONCLUSIVE`. Never convert an unrun check to PASS.

### Level 1 — Static / Unit (fully automated)

From Phase 1 onward, `npm run verify` is the canonical entry point. With no external dependencies, Node's built-in `node:test` plus small inspection scripts validate manifest JSON and JavaScript syntax; forbidden permissions/patterns, secrets, telemetry, and remote endpoints; host normalization and invalid/wildcard rejection; Site/settings/schema/revision and stable IDs; one-milestone Profile Set and unchanged Default; and all DNR/state/failure invariants listed in Japanese.

DNR checks require one exact-host rule, `main_frame` only, `modifyHeaders`, and exactly one `User-Agent` `set`, with no UA-CH, subresource, wildcard, or redirect. State tests cover zero rules under Global OFF, storage regeneration under ON, no rule for Default/missing permission, edit/delete diffs, stable IDs, idempotent reconcile, fail-closed schema mismatch, rollback/journal recovery, cleanup warnings, and rule-limit preflight. Finish with `git diff --check`; any failure exits nonzero and blocks later levels. Production and tests import the same pure functions, and Chrome globals remain behind fakeable adapters.

At Phase 2, Node unit tests already cover hostile host cases, IDN/punycode, Site/profile/ID/rule IDs, within-Site and cross-Site duplicates, and immutable CRUD. Chrome API tests and manual checks have not started.

At Phase 3, in-memory fakes automatically cover defaults and clone safety, schema classification, reuse of Phase 2 Site validation, journal consistency, normal commits, stale revisions, each write failure, derived apply/rollback failures, startup decisions for residual journals, fail closed, serialized concurrent mutations, and lost-update prevention. No Chrome API or human check is involved.

At Phase 4, Node unit/contract tests cover exact-origin generation, canonical-host enforcement, all four inspection states, multi-host create, added-host-only edit, whole-collection release, retention for Default/Global OFF, request denial/rejection/post-condition/cleanup failure, remove failure/post-condition, and external revocation. The prior PC PoC PASS remains the real-browser evidence; no new manual test is requested.

At Phase 5, fake-DNR tests cover rule-ID allocation/overflow, Desktop/Mobile/Default/OFF/missing permission, exact-host main-frame UA-only invariants, diffing, stale cleanup, atomic-update read-back, API/post-condition failure, fail closed, and Phase 3 apply/rollback/fail-closed integration. Real Chrome matching and wire UA remain deferred to the consolidated PC Acceptance run.

### Level 2 — PC Chrome Integration Runner

Use a test page/runner present only in an unpacked development package; never expand production permissions for tests. One `Run PC Acceptance Test` gesture immediately requests exact HTTP/HTTPS permission for an entered fixture host. The only human action is approving that browser prompt. The callback then serially snapshots/cleans test state; verifies permission; creates and reads back a Site in actual `chrome.storage.local`; checks Desktop, Mobile, Default, Global OFF/ON, idempotent reconcile, edits/deletes, permission removal and missing-permission fail closed against actual dynamic rules; runs test-only fault injection; and removes only state/rules/permission created by the runner.

The screen and copy/download JSON report `PASS n/n`, `FAIL n`, `MANUAL n`, each step, and minimal error codes. Store no full URL, query, history, Cookie/Auth, or page content. Prompt denial is `MANUAL: permission not granted` and safely stops with no settings/rules left behind.

Actual DNR API comparison proves rule configuration, not wire headers. Level 3 checks wire values once. A real service-worker/extension restart is also checked once at Level 3 while Level 2 tests idempotent reconciliation. Never add `debugger`, `webRequest`, `cookies`, `tabs`, or broad host grants for the runner.

### Level 3 — PC Manual Smoke (one session, one retest only if needed)

One consolidated session verifies what API-state tests cannot: the exact-host prompt surface, actual YouTube display/playback, and reload recovery. Register the two explicit YouTube hosts; test Desktop Web/playback and Live Chat when an appropriate live page exists; test Mobile Web/playback at normal PC viewport; restore Default and Global OFF; and inspect Desktop, Mobile, and native Default main-frame UA once in DevTools. Then return to Global ON plus Desktop, reload the extension, verify settings and derived rules recover, and finish in Default or Global OFF. Do not recapture UA-CH/subresources on every run.

At the first mismatch, stop and retain only Profile, host, health code, runner JSON, and the relevant main-frame evidence. Never clear cookies, reset login, broaden permission, or add exploratory headers. After a fix, repeat the same consolidated session at most once.

### Level 4 — Android / Quetta Final Smoke (one final session)

Test only a release candidate that passed Levels 1/2 and PC smoke. Verify the Quetta-only gaps: unpacked load; exact-host permission during Site registration; Desktop Web at native narrow viewport; playback and Live Chat when available; Default restoration to Mobile/native state; one Global OFF/ON persistence cycle; then Site deletion and exact HTTP/HTTPS permission release. Use remote debugging for main-frame UA only when visual evidence is ambiguous or once for the first release candidate.

This product smoke also deletes the Site and verifies through product diagnostics that exact HTTP/HTTPS permission returns to Not granted. It therefore covers request/contains/remove/post-remove contains, Profile application, and Default restoration, so a separate Quetta Permission Lifecycle Probe is unnecessary. Stop on permission denial, load error, missing rule effect, viewport change, playback failure, or permission cleanup failure; do not repeat PC-proven diagnostics on-device.

### Manual Test Budget

The MVP budget is one prompt approval in the PC integration runner, one PC manual-smoke session (one extra only after a fix), and one final Android/Quetta session. Every request states why automation cannot prove it, what to inspect, the minimum operations, expected results, and the stop condition. Do not fragment visual checks or wire captures across implementation phases.

### Acceptance gate

- Level 1: every automated check passes with no skips.
- Level 2: API lifecycle/reconcile and cleanup pass; the sole prompt is actually approved as a MANUAL step.
- Level 3: Desktop/Mobile/Default/Global OFF, playback, reload recovery, and the three one-time wire checks pass.
- Level 4: Quetta load, exact permission, Desktop/native viewport/playback, Default restoration, and permission release after Site deletion pass.
- Real-browser compatibility of the Chrome 152 Profile Set, general-site compatibility, and CWS submission preparation remain separate release gates; do not infer their outcomes.
