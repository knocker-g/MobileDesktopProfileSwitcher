# Mobile Desktop Profile Switcher プライバシーポリシー

[English](PRIVACY.md)

施行日: 2026年9月8日

Mobile Desktop Profile Switcher（MDPS）は、明示的に登録されたサイトへ、ユーザーが選択した Default、Desktop、Mobile のブラウザ識別プロファイルを適用するChromium拡張機能です。本ポリシーでは、MDPSが処理する情報とその取扱いについて説明します。

## 処理する情報

拡張機能のポップアップを操作している間、MDPSは現在のサイトを識別し、登録済みSiteとの照合や、関連する明示的な操作後のタブ再読み込みを行うため、アクティブタブのURLとhostnameを一時的に処理することがあります。

MDPSは、次の設定を `chrome.storage.local` に保存します。

- ユーザーが設定したSite名
- 各Siteへ明示的に登録したcanonical hostname
- 選択したDefault、Desktop、Mobileプロファイル
- Globalの有効・無効状態
- 設定を一貫して適用し、中断された更新から安全に復旧するために必要な内部識別子、schema、revision、rule、recovery metadata

MDPSは、アクティブタブのpath、query、fragment、ページタイトル、閲覧履歴の一覧を永続保存しません。登録済みSiteには、ユーザーが登録対象として選んだhostまたはURLから得たcanonical hostnameだけを保存します。

## 情報の利用目的

上記の情報は、明示的に登録されたhostへ選択済みのブラウザ識別プロファイルを適用し、ポップアップに該当設定を表示し、必要なサイト権限を管理し、設定状態を安全に復旧するというMDPSの単一目的にのみ使用します。

DesktopおよびMobileプロファイルでは、一致するトップレベルナビゲーションの `User-Agent` request headerだけを変更します。DefaultではUser-Agentを上書きしません。

## 収集しない情報

MDPSは次の情報を収集しません。

- 閲覧履歴の一覧
- ページ内容
- Cookie
- 認証情報またはアカウント情報
- 個人的な通信内容
- 支払、金融、健康、正確な位置情報
- 広告識別子
- analyticsまたはtelemetry

## データ送信

MDPSには、開発者が運営するサーバー、telemetry endpoint、analytics endpoint、広告endpoint、remote configuration serviceがありません。拡張機能は、保存されたSite設定を開発者または第三者へ送信しません。

この説明は、MDPS自身が追加するネットワーク要求についてのものです。ユーザーが閲覧するWebサイトとブラウザ間の通常の通信を説明したり変更したりするものではありません。有効なDesktopまたはMobileプロファイルが適用される場合、MDPSは対象となるトップレベルのWebサイト要求の `User-Agent` headerを変更しますが、開発者や別サービスへの追加要求は生成しません。

## 保存と保持

設定は、対象ブラウザプロファイル内の拡張機能local storageに保持されます。MDPSはChrome sync storageを使用しません。該当するSite設定を編集または削除するか、ブラウザから拡張機能のlocal dataを消去するか、ブラウザがその拡張機能データを削除するまで保持されます。

## 権限

MDPSは次の権限を使用します。

- **`storage`**: 登録済みSite、選択プロファイル、Global有効状態、内部rule/recovery metadataをローカルに保存します。
- **`declarativeNetRequestWithHostAccess`**: ユーザーが許可した登録済みhostへのトップレベルナビゲーション要求に、選択したDesktopまたはMobileの `User-Agent` headerを適用します。
- **`activeTab`**: ポップアップ操作中の現在サイトを読み取り、関連する明示的な操作後に現在のタブを再読み込みします。
- **任意のHTTP/HTTPS host access**: ユーザーが任意のhostnameを登録できるようにします。MDPSがruntimeで要求するのは、登録対象のcanonical hostnameに対応する `https://hostname/*` と `http://hostname/*` だけです。インストール時に全Webサイトへのアクセスを取得するものではありません。

## 共有、販売、広告、プロファイリング

MDPSは、データの販売、第三者との共有、広告への利用、広告またはユーザープロファイルの作成、信用評価や融資目的での利用を行いません。Chrome APIから得た情報は、拡張機能が掲げる単一目的の提供にのみ使用し、Limited Use要件を含むChrome Web Store User Data Policyに従って取り扱います。

## ユーザーによる管理

ポップアップから登録済みSiteを編集または削除できます。ブラウザからSiteのhost permissionを取り消し、MDPSの明示的な操作によって再度許可できます。Global Offにすると、有効なMDPS dynamic ruleが削除されますが、保存済みSite設定、選択プロファイル、許可済み権限は保持され、MDPSを再度Onにした際に復元できます。

## 本ポリシーの変更

MDPSの機能または適用要件が変わった場合、本ポリシーを更新することがあります。重要な変更は、公開ポリシーおよび施行日に反映します。

## 連絡先

[公開前に開発者連絡先を追加]

