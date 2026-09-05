# MobileDesktopProfileSwitcher

## 日本語

viewport を変更せず、ユーザーが許可した site に固定 browser identity profile を適用して Desktop/Mobile Web の通常表示を選択させる Chromium Extension の計画である。

> **現在は仕様・技術調査フェーズであり、Extension はまだ実装されていません。** 本 repository の記述は対応済み、完全動作、production ready、全 Chromium browser 対応を意味しません。未検証事項は未検証として扱います。

### Decision Summary

- MVP profile: `Default`、`Desktop`、`Mobile`。Desktop/Mobileは同一Chrome milestoneの検証済みProfile Setから供給するUA-only `main_frame` profile。
- 最小 permission 候補: `storage`、`declarativeNetRequestWithHostAccess`、条件付き `scripting`、および `optional_host_permissions`。install 時 `host_permissions` と `activeTab` は原則不採用。
- architecture: popup/settings → local site/profile model → user-granted host → DNR dynamic rules → reload。Profile Setは製品同梱で、外部server、runtime latest取得、remote configurationはない。
- technical risks: UA/UA-CH/JavaScript/Worker の不整合、Android Chromium API 差、DNR rule competition、YouTube 側の判定変更、MAIN-world patch の脆弱性。
- 実装開始前 gate: header 変更可否、A/B/ablation、Native Live Chat 再現性、permission lifecycle、CWS policy review。
- UA version policy: 実行中majorへ追従せず、Desktop/Mobileで同じmilestoneを使う検証済みProfile Setを通常package更新として管理。任意version/UA editorなし。
- MAIN-world navigator modification: **要実機検証**。UA header のみで成立すれば採用しない。
- Client Hints 整合性: **supported Extension API だけで完全整合できるとは現時点で確認できない**。特に `navigator.userAgentData` と Worker/high-entropy 値が gate。
- Chrome Web Store: **条件付きで公開可能性あり**。optional permission と narrow single purpose は適合方向だが、page patch の必要範囲が審査上の主要 risk。
- 現時点評価: **CONDITIONAL GO**。DNR 中心の最小 profile が実機で目的を達成すれば GO、侵襲的/非対応 API または service-specific spoof が必要なら NO-GO。

### Documents

- [Product Goal](PRODUCT_GOAL.md) / [Non-Goals](NON_GOALS.md) / [Supported Browsers](SUPPORTED_BROWSERS.md)
- [User Stories](USER_STORIES.md) / [Profile Model](PROFILE_MODEL.md) / [Site Settings Model](SITE_SETTINGS_MODEL.md) / [UI Spec](UI_SPEC.md)
- [Browser Identity Investigation](BROWSER_IDENTITY_INVESTIGATION.md) / [Permissions Analysis](PERMISSIONS_ANALYSIS.md) / [Technical Investigation Plan](TECHNICAL_INVESTIGATION_PLAN.md)
- [Safety Boundaries](SAFETY_BOUNDARIES.md) / [Privacy Model](PRIVACY_MODEL.md) / [CWS Publication Notes](CWS_PUBLICATION_NOTES.md)
- [MVP Scope](MVP_SCOPE.md) / [Future Scope](FUTURE_SCOPE.md)

## English

This repository plans a Chromium extension that leaves the viewport unchanged and applies a fixed browser identity profile to user-approved sites, letting normal site behavior select Desktop or Mobile Web.

> **The project is currently in specification and technical-investigation phase; the extension has not been implemented.** Nothing here claims existing support, full operation, production readiness, or compatibility with every Chromium browser. Unverified items remain explicitly unverified.

### Decision Summary

- MVP profiles: `Default`, `Desktop`, and `Mobile`. Desktop and Mobile are UA-only `main_frame` profiles supplied by one Verified Profile Set at the same Chrome milestone.
- Minimum permission candidate: `storage`, `declarativeNetRequestWithHostAccess`, conditional `scripting`, and `optional_host_permissions`. Avoid install-time `host_permissions` and normally omit `activeTab`.
- Architecture: popup/settings → local site/profile model → user-granted host → DNR dynamic rules → reload. The Profile Set is bundled; there is no external server, runtime latest-version lookup, or remote configuration.
- Risks: inconsistent UA/UA-CH/JavaScript/Worker surfaces, Android Chromium API differences, competing DNR rules, changing YouTube detection, and fragile MAIN-world patching.
- Pre-implementation gates: header capability, A/B and ablation tests, reproducible Native Live Chat outcome, permission lifecycle, and CWS policy review.
- UA version policy: do not track the running major; manage a packaged Verified Profile Set whose Desktop and Mobile values share one milestone. No arbitrary version or UA editor.
- MAIN-world navigator modification: **requires device testing** and is omitted if the UA header alone works.
- Client Hints consistency: **not currently confirmed achievable using only supported Extension APIs**, especially for `navigator.userAgentData`, Worker, and high-entropy values.
- Chrome Web Store: **conditionally publishable**. Optional grants and a narrow purpose are favorable; required page-patch scope is the main review risk.
- Current decision: **CONDITIONAL GO**. Move to GO if a minimal DNR-centered profile succeeds on-device; NO-GO if invasive/unsupported APIs or service-specific spoofing are required.

The Documents list above is language-neutral and links to every bilingual specification file.
