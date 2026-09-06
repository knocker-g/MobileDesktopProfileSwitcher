# Permission Lifecycle / Permission lifecycle

## Phase 4 implementation contract (English primary)

Phase 4 implements permission planning as Chrome-independent core logic and isolates the real API behind `createChromePermissionsAdapter(permissionsApi)`. For one canonical hostname, the indivisible product permission set is the exact pair `https://host/*` and `http://host/*`. A host is `fully_granted`, `partial_https`, `partial_http`, or `not_granted`; only the first state is eligible for later DNR generation.

Create planning includes every new Site host in one duplicate-free request. Edit planning includes added hosts only. The plan and pre-request inspection must be prepared before the click handler calls `executePermissionRequest()`. Its first synchronous effect is `permissions.request()`, preserving the direct user gesture; only afterward does it verify every origin with `contains()`. Denial or a failed post-condition blocks the entire Site mutation and best-effort removes only origins newly granted by that attempt. It never removes a pre-existing grant.

Release planning compares the complete validated Site collection before and after mutation. It releases a host only when that host is absent from the resulting storage source of truth. Consequently, Default and Global OFF retain permissions. Removal runs only after the future Site transaction commits and verifies the post-condition with per-origin `contains()`. Failure is reported for later cleanup without restoring a deleted Site or activating a rule.

The adapter accepts an injected permissions API and normalizes rejected `contains`, `request`, and `remove` calls. Core execution validates a plan again before invoking the adapter, so a forged wildcard, broad origin, unrelated host, duplicate origin, or incomplete HTTP/HTTPS set cannot reach the browser API. `inspectStoredSitePermissions()` reports `ready`, `permission_partial`, or `permission_missing_or_revoked` for later reconciliation. The Permissions API exposes current grants but not whether an absent grant was externally revoked or never granted, so the core does not invent that history. Phase 4 adds no listener, service worker, storage integration, DNR, or UI.

## Phase 4実装契約（日本語補足）

Phase 4はpermission planをChrome非依存coreとして実装し、実APIを`createChromePermissionsAdapter(permissionsApi)`の背後へ隔離する。canonical hostname 1件に対する製品permission単位は、exactな`https://host/*`と`http://host/*`の組である。状態は`fully_granted`、`partial_https`、`partial_http`、`not_granted`に分け、後続DNR対象になれるのはfully grantedだけである。

Site作成planは全新規hostを重複なしの1 requestへまとめ、編集planは追加hostだけを含む。planとrequest前inspectionはclick前に準備し、click handlerから`executePermissionRequest()`を呼ぶ。その最初の同期effectが`permissions.request()`なので直接user gestureを維持し、その後に全originを`contains()`で確認する。拒否またはpost-condition不成立ではSite mutation全体を止め、今回新規取得したoriginだけをbest-effortでremoveし、既存grantには触れない。

release planはmutation前後の検証済みSite collection全体を比較し、変更後storage正本に存在しないhostだけを解放する。このためDefaultとGlobal OFFはpermissionを保持する。removeは将来のSite transaction commit後にだけ行い、origin別`contains()`でpost-conditionを確認する。失敗は後続cleanup用に報告し、削除済みSiteを戻したりruleを有効化したりしない。

adapterはpermissions APIを注入可能で、`contains`、`request`、`remove`のrejectを正規化する。coreはadapter呼出し直前にもplanを検証するため、偽造wildcard、broad origin、無関係host、重複origin、不完全なHTTP/HTTPS setはbrowser APIへ到達しない。`inspectStoredSitePermissions()`は後続reconcile向けに`ready`、`permission_partial`、`permission_missing_or_revoked`を返す。Permissions APIは現在grantだけを示し、不在grantが外部revokeか未取得かの履歴は示さないため、coreは推測で区別しない。Phase 4ではlistener、service worker、storage接続、DNR、UIは追加しない。

## 日本語

### Permission構成

MVPのAPI permissionは`storage`、`declarativeNetRequestWithHostAccess`、`activeTab`とする。`activeTab`はaction popupを開いたユーザー操作時だけ現在tab URLを読み、host入力をprefillするために使う。`tabs` permission、`scripting`、`webRequest`、`cookies`、`debugger`、`declarativeNetRequestFeedback`は要求しない。

任意hostをユーザーが登録できるよう、manifestの`optional_host_permissions` capability envelopeは`http://*/*`と`https://*/*`とする。これはinstall時または一括のgrantではない。runtime requestは必ず正規化済みの明示hostごとの`http://host/*`と`https://host/*`だけを、直接のuser gesture内で要求する。`<all_urls>`、wildcard subdomain、全hostをまとめたrequestは禁止する。

### Lifecycle

| Event | Permission behavior | DNR/storage behavior |
|---|---|---|
| Site追加 | 全新規hostを1回の`permissions.request()`にまとめ、直後に各originを`contains()`で確認 | 全host許可時だけtransaction開始。拒否/一部許可ならSiteを保存しない |
| Site編集・host追加 | 追加host分だけrequest | 拒否時はpersist済みSite全体を変更せずdraftを保持 |
| host削除 | commit成功後に削除hostのHTTP/HTTPS originを`permissions.remove()` | rule/storageから先に除去 |
| Site削除 | commit成功後に全host originをremove | Site/ruleを先に除去 |
| Profile→Default | permission保持 | Site保持、rule削除 |
| Global OFF | permission保持 | 全MDPS dynamic rule削除、設定保持 |
| Global ON | `contains()`で再確認 | 許可済みDesktop/Mobile Siteからrule再構築 |
| browser UIで外部revoke | 次回startup/UI/reconcileで検出 | 対象hostのruleを生成せず`permission_missing`表示。設定は保持 |

Site追加requestがfalse、またはrequest後のhost別確認が一部だけtrueなら作成を中止する。request前から存在したgrantは触らず、この操作で新規取得したgrantだけをbest-effortでremoveして元状態へ戻す。Chromeが一括requestをatomicに扱っても、post-checkを省略しない。

削除後のpermission解放失敗はidentity変更の継続を意味しない。ruleと設定を先に除去し、UIに`permission_cleanup_required`を表示して再試行可能にする。同一host複数Siteは禁止なので参照計数は不要である。

DefaultとGlobal OFFでpermissionを保持するのは、登録済みhost groupを保ち、再有効化時の反復promptを避けるためである。最小権限との均衡として、UIに保持状態を表示し、host/Site削除および明示的なpermission解放操作を提供する。保持permissionだけでruleを有効化せず、storage設定とglobal stateの両方を満たす場合だけDNRへ反映する。

### Current Site導線

比較結果は次のとおり。

| Option | Permission/complexity | UX | MVP判断 |
|---|---|---|---|
| A. 手入力のみ | 最小だが入力誤りが増える | Androidで負荷大 | fallbackとして提供 |
| B. 現在siteから追加 | `activeTab`のみ追加。host prefill後に確認画面 | 権限と操作の均衡が良い | **採用** |
| C. popup即設定 | permission request、Site作成、profile変更を一操作へ詰める | 誤操作/transaction説明が難しい | MVPでは不採用 |

popup actionのuser gestureで`chrome.tabs.query()`からactive tabのURLを読み、HTTP(S) hostnameだけをフォームへprefillする。URL、path、query、titleは保存しない。既存hostなら該当Siteとprofileを表示する。新規hostはユーザーがSite名/profileを確認してSaveした別のuser gestureでexact optional permissionを要求する。`activeTab`はhost permissionの代替にはしない。

### Lifecycle PoC

`investigation/permission-lifecycle-probe/`に、DNR/storageを含まないrequest → contains → remove → containsの独立PoCを用意した。PC Chrome実機では、exact hostに対するHTTP/HTTPS同時request、両schemeの`contains() = true`、`remove() = true`、remove後の両schemeの`contains() = false`を観測し、最小cycleをPASSと判定した。Quetta Androidでの単独PoCは未実施であり、同等以上の確認を製品版Android final smokeへ統合できる。

## English

### Permission set

MVP API permissions are `storage`, `declarativeNetRequestWithHostAccess`, and `activeTab`. `activeTab` is used only after the user invokes the action popup to read the current tab URL and prefill a host input. Do not request `tabs`, `scripting`, `webRequest`, `cookies`, `debugger`, or `declarativeNetRequestFeedback`.

To let users register arbitrary hosts, the manifest `optional_host_permissions` capability envelope is `http://*/*` plus `https://*/*`. This is neither an install-time nor a blanket grant. Every runtime request, made within a direct user gesture, contains only `http://host/*` and `https://host/*` for normalized explicit hosts. Never use `<all_urls>`, wildcard subdomains, or a request for every host.

### Lifecycle

The event table in the Japanese section is normative and has the following identical behavior: create requests all new hosts together and persists only after per-origin verification; edit requests additions only and preserves the old Site on denial; host/Site deletion removes rules and storage before releasing permission; Default and Global OFF retain permissions while removing rules; Global ON rebuilds only after `contains()` verification; and external revocation keeps settings but suppresses rules and surfaces `permission_missing`.

If a create request returns false or post-request checks show a partial grant, abort creation. Preserve grants that existed before the request and best-effort remove only grants newly obtained by this operation. Perform the post-check even if Chrome normally treats the grouped request atomically.

A permission-release failure after deletion cannot leave identity modification active because rules and settings are removed first. Surface `permission_cleanup_required` and allow retry. Since a host cannot belong to multiple Sites, reference counting is unnecessary.

Default and Global OFF retain permission to preserve registered host groups and avoid repeated prompts on reactivation. Balance minimum permission by showing retained status and providing host/Site deletion plus an explicit release action. A retained grant alone never activates a rule; both storage settings and global state must require it.

### Current Site flow

The MVP adopts option B: use `activeTab` to prefill the current HTTP(S) hostname after action invocation, while keeping manual entry as fallback. Option A alone is lower-permission but burdens mobile users and increases input errors. Option C combines permission, creation, and profile mutation too opaquely and is excluded from MVP.

Use `chrome.tabs.query()` under the popup-action gesture to read the active URL, then prefill only its hostname. Do not store URL, path, query, or title. For an existing host, show its Site and profile. For a new host, a separate Save gesture confirms Site name/profile and requests exact optional permission. `activeTab` never substitutes for persistent host permission.

### Lifecycle PoC

`investigation/permission-lifecycle-probe/` contains an independent request → contains → remove → contains PoC with no DNR or storage. On a PC Chrome device, the minimum cycle passed: one exact-host request covered HTTP and HTTPS, `contains()` was true for both schemes, `remove()` returned true, and post-remove `contains()` was false for both. The standalone Quetta Android PoC remains untested and may be replaced by an equal-or-stronger check in the product Android final smoke.
