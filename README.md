# MobileDesktopProfileSwitcher

## 日本語

viewport を変更せず、ユーザーが許可した site に固定 browser identity profile を適用して Desktop/Mobile Web の通常表示を選択させる Chromium Extension の計画である。

> **現在は仕様・技術調査フェーズであり、Extension はまだ実装されていません。** 本 repository の記述は対応済み、完全動作、production ready、全 Chromium browser 対応を意味しません。未検証事項は未検証として扱います。

### Decision Summary

- MVP profile: `Default`、`Desktop`、`Mobile`。Desktop/Mobileは同一Chrome milestoneの検証済みProfile Setから供給するUA-only `main_frame` profile。
- MVP permission: `storage`、`declarativeNetRequestWithHostAccess`、現在host prefill限定の`activeTab`、exact runtime grant用`optional_host_permissions`。`tabs`、`scripting`、install時host grantは不採用。
- architecture: popup/settings → storage正本のSite（複数明示host+1 profile）→ exact user grant → hostごとのDNR dynamic rule → reload。Global OFFはruleを全削除。Profile Setは製品同梱で外部取得なし。
- technical risks: UA/UA-CH/JavaScript/Workerの意図的な不一致、Android Chromium API差、permission/storage/DNR lifecycle、rule limit、YouTube側の判定変更。
- 実装開始前 gate: 最初の製品Profile Set、permission request/remove、Global OFF/ON、storage/DNR rollback・recovery、rule limit、PC/Android UI lifecycle、CWS review。
- UA version policy: 実行中majorへ追従せず、Desktop/Mobileで同じmilestoneを使う検証済みProfile Setを通常package更新として管理。任意version/UA editorなし。
- MAIN-world navigator modification: YouTube成立条件では不要だったためMVP不採用。
- Client Hints 整合性: **supported Extension API だけで完全整合できるとは現時点で確認できない**。特に `navigator.userAgentData` と Worker/high-entropy 値が gate。
- Chrome Web Store: **条件付きで公開可能性あり**。optional exact-host grantとnarrow single purposeは適合方向。optional capability envelope、保持permission、`activeTab`の説明とlifecycle再現性がgate。
- 現時点評価: **CONDITIONAL GO**。UA-only方式は対象条件で成立済み。最初の製品Profile Setとpermission/storage/DNR lifecycle、一般site、CWS検証が残る。

### Documents

- [Product Goal](PRODUCT_GOAL.md) / [Non-Goals](NON_GOALS.md) / [Supported Browsers](SUPPORTED_BROWSERS.md)
- [User Stories](USER_STORIES.md) / [Profile Model](PROFILE_MODEL.md) / [Profile Set Policy](PROFILE_SET_POLICY.md) / [Site Settings Model](SITE_SETTINGS_MODEL.md) / [UI Spec](UI_SPEC.md)
- [Permissions Analysis](PERMISSIONS_ANALYSIS.md) / [Permission Lifecycle](PERMISSION_LIFECYCLE.md) / [DNR Rule Model](DNR_RULE_MODEL.md) / [Storage Model](STORAGE_MODEL.md)
- [Browser Identity Investigation](BROWSER_IDENTITY_INVESTIGATION.md) / [Technical Investigation Plan](TECHNICAL_INVESTIGATION_PLAN.md)
- [Safety Boundaries](SAFETY_BOUNDARIES.md) / [Privacy Model](PRIVACY_MODEL.md) / [CWS Publication Notes](CWS_PUBLICATION_NOTES.md)
- [MVP Scope](MVP_SCOPE.md) / [Future Scope](FUTURE_SCOPE.md)

## English

This repository plans a Chromium extension that leaves the viewport unchanged and applies a fixed browser identity profile to user-approved sites, letting normal site behavior select Desktop or Mobile Web.

> **The project is currently in specification and technical-investigation phase; the extension has not been implemented.** Nothing here claims existing support, full operation, production readiness, or compatibility with every Chromium browser. Unverified items remain explicitly unverified.

### Decision Summary

- MVP profiles: `Default`, `Desktop`, and `Mobile`. Desktop and Mobile are UA-only `main_frame` profiles supplied by one Verified Profile Set at the same Chrome milestone.
- MVP permissions: `storage`, `declarativeNetRequestWithHostAccess`, `activeTab` limited to current-host prefill, and optional host permission for exact runtime grants. Exclude `tabs`, `scripting`, and install-time host grants.
- Architecture: popup/settings → storage-authoritative Site (multiple explicit hosts plus one profile) → exact user grant → one DNR dynamic rule per host → reload. Global OFF removes every rule. The Profile Set is bundled with no external lookup.
- Risks: intentional UA versus UA-CH/JavaScript/Worker inconsistency, Android Chromium API differences, permission/storage/DNR lifecycle, rule limits, and changing YouTube detection.
- Pre-implementation gates: first product Profile Set; permission request/removal; Global OFF/ON; storage/DNR rollback and recovery; rule limits; PC/Android UI lifecycle; and CWS review.
- UA version policy: do not track the running major; manage a packaged Verified Profile Set whose Desktop and Mobile values share one milestone. No arbitrary version or UA editor.
- MAIN-world navigator modification: excluded from MVP because the YouTube success condition did not require it.
- Client Hints consistency: **not currently confirmed achievable using only supported Extension APIs**, especially for `navigator.userAgentData`, Worker, and high-entropy values.
- Chrome Web Store: **conditionally publishable**. Optional exact-host grants and a narrow purpose are favorable; explaining the optional capability envelope, retained permission, and `activeTab`, plus reproducible lifecycle behavior, are gates.
- Current decision: **CONDITIONAL GO**. UA-only passed the target conditions; the first product Profile Set, permission/storage/DNR lifecycle, general-site behavior, and CWS validation remain.

The Documents list above is language-neutral and links to every bilingual specification file.
