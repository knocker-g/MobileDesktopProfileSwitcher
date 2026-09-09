# Mobile Desktop Profile Switcher

[English](README.md)

Mobile Desktop Profile Switcher（MDPS）は、登録したSiteごとに **Default**、**Desktop**、**Mobile**のbrowser identity profileを設定できる軽量なChromium拡張機能です。選択したProfileは、登録済みの一致するhostへ自動適用されます。

MDPSはdevice emulatorではありません。Desktop/Mobile Profileが変更するのは、一致するtop-level navigationの`User-Agent` request headerだけです。viewport、device pixel ratio、touch input、JavaScriptから見えるnavigator/platform identity、UA Client Hints、page contentは変更しません。

## Status

Version 1.0.0ではMVP実装が完了しています。Release CandidateはPC Chromeの統合Acceptanceと、Android上のQuettaによる実機検証にPASSしています。ただし、すべてのWebサイトやChromium系browserとの互換性を保証するものではありません。

## Features

- SiteごとのDefault / Desktop / Mobile Profile
- 1つのlogical Siteへの複数の明示host登録
- 一致するtop-level navigationへの自動適用
- Siteやpermissionを削除しないGlobal On/Off
- 登録hostごとのexact-host permission grant
- permission喪失の検出とユーザー操作による復旧
- Current SiteのProfileをすばやく切替
- 関連する明示的な状態変更成功後のcurrent page自動reload
- extension local storageだけに保存される設定
- telemetry / analyticsなし
- Chromium Manifest V3

## Site model

1つのlogical Siteは複数の明示hostを持つことができ、Site全体で1つのProfileを共有します。例：

```text
YouTube
- www.youtube.com
- m.youtube.com
```

YouTubeは実機検証に使用した例であり、製品が依存する特定サービスではありません。MDPSは明示hostnameだけを扱い、ページURLのrewrite、redirect、canonicalizationは行いません。

## Profiles

### Default

MDPSはそのSiteの`User-Agent`を上書きしません。

### Desktop

初期Verified Profile SetはChrome milestone 152です。

```text
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36
```

### Mobile

初期Verified Profile SetはChrome milestone 152です。

```text
Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36
```

DesktopとMobileは、意図的に同じ検証済みChrome milestoneを使用します。Profile SetはMDPS releaseに同梱されます。インストール済みbrowserのmajor versionへの追従、最新UAのremote取得、任意UA編集は行いません。

## How it works

MDPSはManifest V3の`chrome.declarativeNetRequest` dynamic rulesを、ローカル保存したSite設定から生成します。登録済みかつ必要permissionがすべて許可されたhostごとに1 ruleを作成します。ruleはHTTP/HTTPSのtop-level `main_frame` requestだけを対象に、requestの`User-Agent` headerだけを`set`します。

subresource、response header、UA Client Hints、JavaScript identity、viewportは変更しません。content scriptやredirectも使用しません。

## Permissions

必須extension permissions：

- `storage`: Global stateと登録Site設定をローカル保存します。
- `declarativeNetRequestWithHostAccess`: 許可されたhostへ選択中UA Profileを適用します。
- `activeTab`: ユーザーがPopupを操作している間のCurrent Site検出と、関連する明示操作後のcurrent tab reloadに使用します。

任意の明示hostをユーザーが登録できるよう、manifestには次のoptional host permission capability envelopeを宣言しています。

```text
http://*/*
https://*/*
```

これはすべてのWebサイトへの恒久的なaccessを許可するものではありません。Site追加時に要求するのは、canonical hostnameごとの次のexact-host pairだけです。

```text
https://hostname/*
http://hostname/*
```

MDPSはbrowsing history permissionを要求しません。

## Privacy

MDPSにはtelemetry、analytics、外部server、remote configurationがありません。browsing historyやpage contentを収集せず、Cookie、authentication data、account dataへアクセスしません。データの販売・共有も行いません。

設定はextension local storage内に保持されます。登録Site情報にはcanonical hostnameが含まれます。Popup操作中はCurrent Site判定のためcurrent tab URLを一時処理することがありますが、永続化するのは登録Site設定に必要なcanonical hostnameだけで、path、query、fragmentは保存しません。

## Scope and safety

MDPSは予測可能なper-site Profile Switcherであり、汎用identity generatorや制限回避toolではありません。任意UA編集、Profile rotation、proxy/IP操作、Cookie/Auth操作、CAPTCHA/rate-limit/restriction bypass、特定service内部API spoof、fingerprint randomization、page content操作、viewport/device emulationは提供しません。

## インストール

[Chrome Web Store](https://chromewebstore.google.com/detail/mobile-desktop-profile-sw/ehodmekcjnghcibjjnieleddaibhbilk)からMDPSをインストールできます。

## Development / unpacked installation

開発用に現在のsourceを読み込む手順：

1. このrepositoryをcloneまたはdownloadします。
2. Chromeまたは互換Chromium browserで`chrome://extensions`を開きます。
3. **Developer mode**を有効にします。
4. **Load unpacked**を選択します。
5. `manifest.json`があるrepository rootを選択します。

## Usage

1. 対象Siteを開き、MDPS Popupを開きます。
2. Current Siteを追加します。
3. 必要に応じて明示hostを追加・編集します。
4. Default、Desktop、Mobileのいずれかを選択します。
5. 表示されたexact hostへのaccessを許可します。
6. MDPSが一致するtop-level navigationへ選択Profileを適用します。

Global switchを使うと、保存済みSite、選択Profile、保持permissionを削除せずに、MDPSのUA override全体を停止・復元できます。

## Tested environments

- PC Chrome: MVP統合Acceptance PASS
- Android上のQuetta: MVP実機検証 PASS

その他のChromium系browserやdeviceでは、Extension API対応とWebサイトの挙動が異なる場合があります。一律の互換性は保証しません。

## Known limitations

- UA変更だけで、すべてのWebサイトが別layoutへ切り替わるとは限りません。
- Webサイトは`User-Agent`以外のsignalを利用する場合があり、その挙動は予告なく変わり得ます。
- Desktop/Mobile Profileは完全なdeviceをemulateしません。
- PC上のMobile ProfileはPC viewportを維持します。
- Android上のDesktop ProfileはAndroid native viewportを維持します。
- Profile SetはMDPS releaseごとに検証され、インストール済みbrowserとは動的同期しません。

## Development and verification

Node標準test runnerを使用し、runtime/testともに外部dependencyはありません。

```text
npm test
npm run verify
npm run acceptance:preflight
```

research probeとinvestigation資料は`investigation/`配下へ分離されており、production extension packageから除外する必要があります。

詳細な設計・調査資料として、[Profile Set Policy](PROFILE_SET_POLICY.md)、[Site Settings Model](SITE_SETTINGS_MODEL.md)、[Permission Lifecycle](PERMISSION_LIFECYCLE.md)、[DNR Rule Model](DNR_RULE_MODEL.md)、[Storage Model](STORAGE_MODEL.md)、[Acceptance Test Strategy](ACCEPTANCE_TEST_STRATEGY.md)があります。

## License

[MIT License](LICENSE)で提供します。

Copyright (c) 2026 knocker-g
