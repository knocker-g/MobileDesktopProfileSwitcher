# Permission Lifecycle Probe / Permission lifecycle調査probe

## 日本語

### 目的と境界

これはMobileDesktopProfileSwitcher（MDPS）の製品コードではなく、PC ChromeとQuetta AndroidでManifest V3 optional host permissionの最小cycleを確認する独立した調査用Extensionである。

確認対象は次の6点に限定する。

1. button clickから明示hostのpermissionをrequestできる。
2. request後に`chrome.permissions.contains()`がtrueになる。
3. `chrome.permissions.remove()`で解放できる。
4. remove後に`contains()`がfalseになる。
5. PC Chromeで成立する。
6. Quetta Androidで成立する。

DNR、header変更、storage、content script、tab操作、page内容取得、Cookie/Auth、telemetry、外部通信は実装しない。operation logはpopup memory内だけにあり、hostnameとboolean相当の結果だけを表示する。閉じると消える。

### Manifest permission

- API permission: なし（`permissions: []`）。`chrome.permissions` API自体のための追加permissionは不要。
- Optional capability envelope: `http://*/*`、`https://*/*`。
- Install-time `host_permissions`: なし。

optional capability envelopeはrequest可能範囲であり、install時または全siteへのgrantではない。実際のrequestは正規化済みhostnameについて次のexact originだけを1回のpromptで要求する。

```text
https://hostname/*
http://hostname/*
```

MVP製品設計ではscheme単位設定を持たず、1つのhost設定をHTTP/HTTPS双方へ適用する。このlifecycleを同じ形で検証するため、PoCも両schemeをまとめてrequest/check/removeし、結果はHTTPS/HTTP別に表示する。wildcard subdomainは要求しない。例えば`www.youtube.com`は`*.youtube.com`を含まない。

Chrome公式仕様では、optional permissionはmanifestで宣言した範囲からuser gesture内の`permissions.request()`で取得し、`contains()`で確認し、`remove()`で解放できる。

- [chrome.permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)

### Host正規化

bare hostnameまたはHTTP(S) URLを受け付ける。trim後、標準`URL` parserでhostnameを抽出・IDNA ASCII化し、lowercase化してtrailing dotを除去する。scheme、port、path、query、fragmentはpermission keyへ含めない。userinfo、HTTP(S)以外のscheme、不正host、wildcardを拒否する。完全な入力URLはlogへ出さない。

例:

| Input | Normalized | Requested origins |
|---|---|---|
| `WWW.YouTube.COM.` | `www.youtube.com` | exact HTTP + HTTPS |
| `https://www.youtube.com/watch?v=...` | `www.youtube.com` | exact HTTP + HTTPS |
| `https://www.youtube.com:8443/path` | `www.youtube.com` | exact HTTP + HTTPS（portは設定単位外） |
| `*.youtube.com` | error | なし |

このPoC実装をそのまま製品コードへ流用する前提にはしない。

### User gesture保証

`Request permission`のclick handlerは、入力を同期的に正規化した直後に`chrome.permissions.request()`を呼ぶ。その前に`await`、timer、message round-trip、network処理を置かない。request callback後にだけ`contains()`を実行してpost-request状態を自動表示する。この構造がQuettaでuser gestureを保持するかは実機確認対象である。

### Load方法

PC Chrome:

1. `chrome://extensions`を開きDeveloper modeをONにする。
2. `Load unpacked`からこのdirectoryを選ぶ。
3. Extension actionを押してpopupを開く。

Quetta Android:

1. このdirectoryを端末から選択可能な場所へ配置する。
2. QuettaのExtension管理画面でDeveloper modeを有効にする。
3. unpacked Extensionとしてこのdirectoryを読み込む。
4. Extension actionを押してpopupを開く。

Quettaの画面名・配置はbuildにより異なり得る。load errorがないことを確認し、他のidentity変更Extensionはこのpermission試験には不要である。

### 最小test cycle

PC ChromeとQuettaで別々に同じ手順を行う。

1. `www.youtube.com`を入力し、normalized hostnameを確認する。
2. `Check permission`を押す。初期期待値はHTTPS/HTTPとも`Not granted`。既存grantがある場合は先にRemoveする。
3. `Request permission`を押し、browser promptを許可する。
4. callback後の自動`POST-REQUEST CONTAINS`でHTTPS/HTTPとも`Granted`を確認する。必要ならCheckを1回押して再確認する。
5. `Remove permission`を押す。
6. callback後の自動`POST-REMOVE CONTAINS`でHTTPS/HTTPとも`Not granted`を確認する。必要ならCheckを1回押す。

最小PASSは、同一環境でRequestがgranted、両schemeのpost-request containsがtrue、Removeがremoved、両schemeのpost-remove containsがfalseになること。拒否を選んだ場合はdeniedを正常に表示し、PASS判定にはしない。実測結果はまだ未記録である。

### External revoke（第二段階）

1. Request後、ProbeでGrantedを確認する。
2. browserのExtension詳細またはSite access UIから対象host accessを手動revokeする。
3. popupを開き直し、同じhostで`Check permission`を押す。
4. HTTPS/HTTPの実際の状態が`Not granted`になることを記録する。

browser UIがschemeをまとめて表示する場合や片方だけをrevokeできない場合があるため、最終判定はProbeのscheme別`contains()`結果を使う。External revokeは基本cycleの必須PASS条件ではない。

### 判定記録

| Environment | Request | HTTPS after request | HTTP after request | Remove | HTTPS after remove | HTTP after remove | Result |
|---|---|---|---|---|---|---|---|
| PC Chrome | Granted | Granted | Granted | Removed (`true`) | Not granted | Not granted | **PASS** |
| Quetta Android | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

PC Chromeでは上記の最小cycleを実測した。exact-host requestは1回のpromptでHTTP/HTTPS両方に付与され、remove後は両方ともNot grantedへ戻った。external revoke試験は未実施であり、最小cycleのPASSには含めない。Quetta Android単独PoCは未実施で、製品版Android final smokeで同等以上の確認を行える場合は省略できる。

## English

### Purpose and boundary

This is an independent investigation-only Manifest V3 extension, not MobileDesktopProfileSwitcher product code. It checks the same six capabilities listed in Japanese on PC Chrome and Quetta Android: request exact-host optional permission from a button gesture, verify it with `contains()`, release it with `remove()`, verify false afterward, and reproduce the cycle on both environments.

It implements no DNR, header modification, storage, content script, tab operation, page-content access, cookie/auth access, telemetry, or external communication. Its in-memory popup log contains only the normalized hostname and boolean-like operation outcomes and disappears when the popup closes.

### Manifest permission

There is no API permission (`permissions: []`). The optional capability envelope is `http://*/*` plus `https://*/*`, with no install-time `host_permissions`. The envelope only declares what may be requested and grants no site at installation. One prompt requests only exact `https://hostname/*` and `http://hostname/*` origins for the normalized host, never a wildcard subdomain.

The product model has no per-scheme setting: one host applies to both HTTP and HTTPS. The PoC therefore requests, checks, and removes both schemes together while displaying each result separately. Chrome's official optional-permission model requires a declared optional range, a `permissions.request()` call inside a user gesture, verification with `contains()`, and release with `remove()`. The official links in the Japanese section apply equally here.

### Host normalization and gesture

Accept a bare hostname or HTTP(S) URL. Trim, extract and IDNA-ASCII-serialize hostname through the standard `URL` parser, lowercase it, and remove trailing dots. Exclude scheme, port, path, query, and fragment from the permission key. Reject user info, non-HTTP(S) schemes, invalid hosts, and wildcards. Never log the full input URL. This PoC is not assumed to be production-reusable code.

The Request button handler normalizes synchronously and immediately calls `chrome.permissions.request()` without an earlier `await`, timer, message round-trip, or network operation. Only the callback runs the post-request `contains()` checks. Whether Quetta preserves the gesture for this structure is part of device testing.

### Loading and minimum cycle

On PC Chrome, open `chrome://extensions`, enable Developer mode, choose this directory with Load unpacked, then open the extension action. On Quetta Android, copy the directory to device-accessible storage, enable Developer mode in its extension manager, load the directory unpacked, and open its action. UI labels may vary by build.

In each environment: enter `www.youtube.com`; Check and expect both schemes Not granted unless a prior grant exists; Request and approve; confirm automatic post-request `contains()` shows both Granted; Remove; confirm automatic post-remove `contains()` shows both Not granted. A PASS requires granted/true/removed/false for both schemes in the same environment.

### External revoke

After Request and a Granted check, manually revoke the host in the browser's extension Site access/detail UI. Reopen the popup and Check the same host. Use the Probe's separate HTTPS/HTTP `contains()` results as evidence because browser UI may group schemes. External revoke is a secondary test, not part of the minimum PASS cycle.

The result table in the Japanese section applies identically. PC Chrome passed the measured minimum cycle: one exact-host prompt granted HTTP and HTTPS, `contains()` confirmed both, `remove()` returned true, and post-remove `contains()` reported both Not granted. External revoke was not tested and is not part of that PASS. The standalone Quetta Android PoC remains Pending and may be omitted when an equal-or-stronger permission-lifecycle check is included in the product Android final smoke.
