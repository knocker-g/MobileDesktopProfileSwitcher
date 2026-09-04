# Identity Probe / Identity調査プローブ

## 日本語

### 目的

Sony Xperia 1 V + Quetta Androidで、Native baselineとUser-Agent Switcher and ManagerによるSuccess baselineのJavaScript-visible browser identityを同じJSON schemaで採取する、読み取り専用の調査toolである。これはMobileDesktopProfileSwitcherの製品コードではなく、Extension機能、identity変更処理、外部通信を含まない。

### 実行方法

Dedicated Workerと`navigator.userAgentData`を利用できるよう、`file://`直開きではなくsecure contextから配信する。推奨は、PC上の任意の既存static file serverでproject rootを配信し、Android SDKの`adb reverse tcp:8000 tcp:8000`のようなUSB port forwardingを設定して、Quettaで`http://localhost:8000/investigation/identity-probe/`を開く方法である。`localhost`はsecure contextとして扱われる。serverやADBは本projectのdependencyとして追加しない。使用するportは実際のserverに合わせる。

`Run Probe`で採取し、`Copy JSON`または`Download JSON`で明示的に保存する。結果は自動送信・永続保存されない。`file://`ではWorker生成やUA-CHが失敗する可能性があるためbaseline比較には使用しない。

### Baseline採取

各run前にviewport、orientation、Quetta/Android/対象Extension version、時刻、network条件を別のrun sheetへ記録する。

1. Native: Quettaの「PC版サイト」をOFF、User-Agent Switcher and ManagerをOFFにし、native viewportでpageをfresh tabに開く。
2. `Run Probe`を押し、JSONを`native-01.json`から`native-05.json`として保存する。
3. 各runはfresh tabから行い、5回の順序はSuccessと交互にする。必要に応じQuetta再起動runを別記する。
4. Success: 同じ端末、Quetta、viewport、account/network条件で「PC版サイト」OFFを維持し、成功確認済みDesktop Chrome/Windows profileをUser-Agent Switcher and ManagerでONにする。
5. 同じ手順で`success-01.json`から`success-05.json`を保存する。

JSONはbaseline/run番号を含む手動file名で端末内に保存し、比較用folderへ明示的に移す。このtool自身はbaseline label、page URL、Cookie、storageを読み取らない。

### 取得範囲と制約

Pageでは`userAgent`、`platform`、`vendor`、`product`、`appVersion`、`language`、`languages`を取得する。Page/Workerの`userAgentData`があれば`brands`、`mobile`、`platform`と、`architecture`、`bitness`、`model`、`platformVersion`、`uaFullVersion`、`fullVersionList`を要求する。各field/APIは`available`、`unavailable`、`unsupported`、`error`として記録される。Dedicated Workerでは取得可能なlegacy identityとUA-CHを同じ形で採取する。

これはJavaScriptから見えるidentityだけを観測する。実際にserverへ送信された`User-Agent`、`Sec-CH-UA`、`Sec-CH-UA-Mobile`、`Sec-CH-UA-Platform`、high entropy Client Hintsを自己観測しない。HTTP wire identityは、別途、管理下の中立的なHTTPS echo endpointまたはbrowser DevToolsのNetwork表示で観測し、このJSONとrun IDで対応付ける。現段階では外部server/proxyを追加しない。

取得しないもの: Cookie、Authorization/OAuth、localStorage/sessionStorage/IndexedDB、既存site data、page content、form/account情報、request/response body、閲覧履歴、IP、telemetry/analytics。identityを変更・randomizeせず、headerやUser-Agentも変更しない。

### 注意事項

Success profileの設定画面値と実測値は区別する。API不在やpermission/secure-context制約は正常な観測結果であり、値を推測で補完しない。download/copy先にはbrowser identityが含まれるため、共有前に内容を確認する。同じorigin、同じtool version、同じ実行条件でbaselineを比較する。

## English

### Purpose

This read-only investigation tool captures JavaScript-visible browser identity from the Native and User-Agent Switcher and Manager Success baselines on Sony Xperia 1 V + Quetta Android using one JSON schema. It is not MobileDesktopProfileSwitcher product code and contains no extension feature, identity modification, or external transmission.

### Running it

Serve it from a secure context rather than opening `file://`, so Dedicated Worker and `navigator.userAgentData` can operate. The recommended setup is an existing static file server on the PC plus USB forwarding such as `adb reverse tcp:8000 tcp:8000`, then open `http://localhost:8000/investigation/identity-probe/` in Quetta. Localhost is treated as a secure context. Neither a server nor ADB is added as a project dependency; match the port to the server in use.

Press `Run Probe`, then explicitly save with `Copy JSON` or `Download JSON`. Results are neither transmitted nor persisted automatically. Do not use `file://` for baseline comparison because Worker creation or UA-CH may fail.

### Baseline collection

Before each run, record viewport, orientation, Quetta/Android/target-extension versions, time, and network in a separate run sheet. For Native, keep Quetta Desktop Site OFF and User-Agent Switcher and Manager OFF, open a fresh tab, and save five runs as `native-01.json` through `native-05.json`. Alternate their order with Success and separately label restart runs. For Success, keep the same device, browser, viewport, account, and network with Desktop Site OFF, enable the proven Desktop Chrome/Windows profile, and save `success-01.json` through `success-05.json`. Move files explicitly into a comparison folder. The tool does not read baseline labels, page URL, cookies, or storage.

### Coverage and limitations

Page collection includes `userAgent`, `platform`, `vendor`, `product`, `appVersion`, `language`, and `languages`. When Page/Worker `userAgentData` exists, it collects `brands`, `mobile`, and `platform`, and requests `architecture`, `bitness`, `model`, `platformVersion`, `uaFullVersion`, and `fullVersionList`. Each field/API records `available`, `unavailable`, `unsupported`, or `error`. A Dedicated Worker collects available legacy identity and UA-CH in the same shape.

This observes only JavaScript-visible identity. It cannot self-observe the actual wire `User-Agent`, `Sec-CH-UA`, `Sec-CH-UA-Mobile`, `Sec-CH-UA-Platform`, or high-entropy Client Hints sent to a server. Observe HTTP wire identity separately with a controlled neutral HTTPS echo endpoint or browser DevTools Network view and correlate it by run ID. Do not add an external server or proxy at this stage.

It does not collect cookies, Authorization/OAuth, localStorage/sessionStorage/IndexedDB, existing site data, page/form/account content, request/response bodies, history, IP, telemetry, or analytics. It does not modify or randomize identity, headers, or User-Agent.

### Notes

Keep configured Success-profile values separate from measured values. Missing APIs and permission/secure-context limitations are valid observations; never fill them with guesses. Copied/downloaded JSON contains browser identity, so inspect it before sharing. Compare baselines using the same origin, tool version, and execution conditions.
