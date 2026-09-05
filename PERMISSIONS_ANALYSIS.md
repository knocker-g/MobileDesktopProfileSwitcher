# Permissions Analysis / Permission分析

## 日本語

### MVP結論

推奨MVP manifestは次の構成とする。

```json
{
  "permissions": [
    "storage",
    "declarativeNetRequestWithHostAccess",
    "activeTab"
  ],
  "optional_host_permissions": [
    "http://*/*",
    "https://*/*"
  ]
}
```

optional patternはユーザーが任意の明示hostを登録できるrequest可能範囲であり、install時grantでも全siteへのruntime requestでもない。実際の`permissions.request()`は直接のuser gesture内で、正規化済みhostごとの`http://host/*`と`https://host/*`だけを含める。

| Permission | 用途 | MVP判断 |
|---|---|---|
| `storage` | Site設定、global enabled、transaction journal、最小healthをlocal保存 | 必要 |
| `declarativeNetRequestWithHostAccess` | 許可hostの`main_frame` UAをdynamic ruleで変更 | 必要 |
| `activeTab` | action起動時に現在tabのHTTP(S) hostだけをprefill | 必要。current-site導線限定 |
| `optional_host_permissions` | ユーザー登録hostだけをruntime grant | 必要。exact host request限定 |
| `tabs` | 不要。`activeTab`下のactive URL取得で足りる | 不採用 |
| `scripting` | JS-visible identityを変更しない | 不採用 |
| `webRequest` / `cookies` / `debugger` | request/account/debug情報を読まない | 不採用 |
| install-time `host_permissions` | broad permanent accessを避ける | 不採用 |

`<all_urls>`とwildcard subdomainをmanifest、保存値、runtime request、DNR ruleに使用しない。`http://*/*`/`https://*/*`はoptional capability envelopeであり、UIとCWS説明でこの相違を明示する。

DefaultおよびGlobal OFFでも、ユーザーが登録済みのexact host grantは保持する。ruleは存在しない。host/Site削除または明示的なpermission解放でgrantをremoveできる。一部許可、拒否、外部revoke、cleanup failureを含む詳細は`PERMISSION_LIFECYCLE.md`を正とする。

根拠: [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)、[`chrome.permissions`](https://developer.chrome.com/docs/extensions/reference/api/permissions)、[`chrome.declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)。

## English

### MVP decision

The recommended MVP manifest uses the exact structure shown in the Japanese section: API permissions `storage`, `declarativeNetRequestWithHostAccess`, and `activeTab`, plus optional host capability envelopes `http://*/*` and `https://*/*`.

Those optional patterns define which explicit user-entered hosts may be requested; they are neither install-time grants nor a runtime request for every site. Each direct-user-gesture `permissions.request()` contains only `http://host/*` and `https://host/*` for normalized explicit hosts.

`storage` persists local settings, global enabled state, the transaction journal, and minimal health. `declarativeNetRequestWithHostAccess` changes only main-frame UA on granted hosts. `activeTab` only prefills the current HTTP(S) host after action invocation. Optional host permission is required only for exact registered hosts.

Do not request `tabs`, `scripting`, `webRequest`, `cookies`, `debugger`, or install-time `host_permissions`. Never use `<all_urls>` or wildcard subdomains in the manifest, persisted values, runtime requests, or DNR rules. Clearly distinguish the optional `http://*/*`/`https://*/*` capability envelope from actual grants in UI and CWS explanations.

Default and Global OFF retain user-granted exact-host permission while leaving no rule active. Host/Site deletion or an explicit release action removes it. `PERMISSION_LIFECYCLE.md` is authoritative for partial grants, denial, external revocation, and cleanup failure.

Sources: [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions), [`chrome.permissions`](https://developer.chrome.com/docs/extensions/reference/api/permissions), and [`chrome.declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest).
