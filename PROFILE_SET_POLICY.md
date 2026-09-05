# Verified Profile Set Policy / 検証済みProfile Set方針

## 日本語

### Design decision

MobileDesktopProfileSwitcher（MDPS）は、UA version管理方式として**検証済みProfile Set**を正式採用する。実行中browserのmajor version、外部のlatest version情報、またはユーザー入力からUAを動的生成しない。MDPSは一般的なUA generatorではなく、予測可能で監査可能なBrowser Profile Switcherとする。

1つのProfile SetはMDPSが検証・採用した単一のChrome milestone `N`を持ち、概念上次の3profileを一体として管理する。

```text
Verified Profile Set
Chrome milestone: N

Default
└─ User-Agent変更なし

Desktop
└─ Windows Chrome N Reduced UA

Mobile
└─ Android Mobile Chrome N Reduced UA
```

DesktopとMobileは必ず同じProfile Set milestoneを使う。個別のversion fieldや独立更新を持たせない。将来の製品コードでは概念的に`PROFILE_SET = { milestone, desktopUserAgent, mobileUserAgent }`として一元管理するが、本decisionではコードを実装しない。

### 動的追従を採用しない理由

実行中のPC Chromeと同じmajorがAndroid側で同時期・同channelに利用可能とは限らない。runtime majorを別platformのUAへ流用すると、MDPSが存在と互換性を確認していないDesktop/Mobile identityの組合せを生成し得る。このためMVPでは次を行わない。

- 実行中browser majorへの自動追従
- latest versionの自動取得
- UA versionの動的生成
- ユーザーによる任意versionまたはUA文字列の指定

### 更新・配布・failure behavior

Profile Set milestoneはMDPS側で一元管理し、通常のMDPS package更新として配布する。新milestoneへ更新する前に、少なくともDesktop Chromeとして妥当なReduced UA、Android Mobile Chromeとして妥当なReduced UA、両profileが同一milestoneで成立すること、主要な既知互換性試験に問題がないことを確認する。全Chrome milestoneへ機械的に追従する必要はないが、siteの最低対応versionへ影響するほど古くなる前に通常メンテナンスとして再検証・更新する。

Profile Setは製品同梱の既知値である。runtimeにUA profile、latest version、remote configurationを取得する外部通信は行わない。従ってversion取得失敗やそのfallbackも存在しない。

### UI

通常UIで選択させるのは`Default`、`Desktop`、`Mobile`だけとする。Chrome/Windows/Android version、browser brand、任意UA、UA editorは通常設定にしない。将来、診断情報として現在のProfile Set IDまたはmilestoneをread-only表示する余地は残す。

### Experimental fixturesとの境界

既存実測のDesktop `Chrome/154.0.0.0`とMobile `Chrome/148.0.0.0`は、異なる環境で使用したexperimental fixtureである。これらはObserved resultの証拠として保持するが、同一製品Profile Setとして組み合わせない。最初の製品Profile Set milestoneは別途選定し、Desktop/Mobile双方を同じmilestoneで検証してから確定する。

### 後続設計

サイト設定・権限モデルは`SITE_SETTINGS_MODEL.md`、`PERMISSION_LIFECYCLE.md`、`DNR_RULE_MODEL.md`、`STORAGE_MODEL.md`で詳細化する。Profile SetはSite設定から参照する製品同梱値であり、Siteごとに複製・編集しない。これらの設計文書は製品コード実装を開始しない。

## English

### Design decision

MobileDesktopProfileSwitcher (MDPS) formally adopts a **Verified Profile Set** for UA version management. It does not dynamically generate UA values from the running browser's major version, externally obtained latest-version data, or user input. MDPS is a predictable and auditable Browser Profile Switcher, not a general UA generator.

One Profile Set contains a single Chrome milestone `N` selected and validated by MDPS, with three profiles managed as one unit:

```text
Verified Profile Set
Chrome milestone: N

Default
└─ no User-Agent modification

Desktop
└─ Windows Chrome N Reduced UA

Mobile
└─ Android Mobile Chrome N Reduced UA
```

Desktop and Mobile always use the same Profile Set milestone. They do not have independent version fields or update paths. Future product code will conceptually centralize this as `PROFILE_SET = { milestone, desktopUserAgent, mobileUserAgent }`, but this decision does not implement code.

### Why runtime tracking is rejected

The same major as the running desktop Chrome may not be available on Android at the same time or channel. Reusing a runtime major for another platform could generate a Desktop/Mobile identity combination whose existence and compatibility MDPS has never validated. Therefore the MVP does not provide:

- automatic tracking of the running browser major;
- automatic latest-version lookup;
- dynamic UA-version generation; or
- user-selected arbitrary versions or UA strings.

### Update, distribution, and failure behavior

MDPS centrally owns the Profile Set milestone and distributes updates through normal packaged MDPS releases. Before adopting a new milestone, verify at minimum a valid Desktop Chrome Reduced UA, a valid Android Mobile Chrome Reduced UA, operation of both profiles at the same milestone, and no problem in the principal known compatibility tests. MDPS need not follow every Chrome milestone mechanically, but normal maintenance must revalidate and update the set before it becomes old enough to affect site minimum-version support.

The Profile Set consists of known values bundled with the product. Runtime external communication does not fetch UA profiles, latest versions, or remote configuration. Consequently there is no version-fetch failure or fallback path.

### UI

The normal UI exposes only `Default`, `Desktop`, and `Mobile`. Chrome, Windows, or Android versions, browser brands, arbitrary UA strings, and a UA editor are not normal settings. A future diagnostic surface may display the current Profile Set ID or milestone read-only.

### Boundary from experimental fixtures

The observed Desktop `Chrome/154.0.0.0` and Mobile `Chrome/148.0.0.0` values are experimental fixtures used in different environments. Keep them as evidence for the observed results, but never combine them into one product Profile Set. Select the first product milestone separately and validate both Desktop and Mobile at that same milestone before adoption.

### Follow-on design

`SITE_SETTINGS_MODEL.md`, `PERMISSION_LIFECYCLE.md`, `DNR_RULE_MODEL.md`, and `STORAGE_MODEL.md` detail the site-settings and permission model. The Profile Set is a bundled product value referenced by Site settings, never copied or edited per Site. These design documents do not begin product-code implementation.
