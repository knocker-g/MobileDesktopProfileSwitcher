# Permissions Analysis / permission 分析

## 日本語

推奨 MVP manifest は `permissions: ["storage", "declarativeNetRequestWithHostAccess", "scripting"]` と `optional_host_permissions: ["http://*/*", "https://*/*"]`。all-sites pattern は「要求可能な範囲」であり install 時の grant ではない。実際には `chrome.permissions.request()` を user gesture 内で current origin に限定する。

| permission | 用途 | より狭い代替 | MVP判断 |
|---|---|---|---|
| `storage` | profile/site 設定を端末内保存 | メモリのみでは永続化不可 | 必要 |
| `declarativeNetRequestWithHostAccess` | 許可 origin の request header を dynamic rule で変更 | `declarativeNetRequest` は install warning を増やす | 条件付き必要 |
| `scripting` | 許可 origin への登録 script/MAIN world 実験 | JS override を採用しなければ削除 | 実験後決定 |
| `activeTab` | user gesture 後の一時 host access/injection | 永続 per-site profile には不足 | MVPでは原則不要 |
| `host_permissions` | 常時 host access | optional grant | 不採用 |
| `declarativeNetRequest` | DNR access、block/allow の implicit access | WithHostAccess が目的に適合 | 不採用 |

`activeTab` は一時試用案には有用だが、reload/将来 navigation をまたぐ記憶済み profile と dynamic rule の安定した権限モデルには不十分。`declarativeNetRequestFeedback`、`tabs`、`webRequest`、`cookies`、`debugger` は要求しない。

根拠: [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)、[`chrome.permissions`](https://developer.chrome.com/docs/extensions/reference/api/permissions)、[`chrome.declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)。

## English

Recommended MVP manifest: `permissions: ["storage", "declarativeNetRequestWithHostAccess", "scripting"]` and `optional_host_permissions: ["http://*/*", "https://*/*"]`. The all-sites pattern defines what may be requested; it is not an install-time grant. At runtime, call `chrome.permissions.request()` from a user gesture for the current origin only.

| Permission | Purpose | Narrower alternative | MVP decision |
|---|---|---|---|
| `storage` | Local profile/site settings | Memory cannot persist | Required |
| `declarativeNetRequestWithHostAccess` | Dynamic request-header rules on granted origins | `declarativeNetRequest` adds an install warning | Conditionally required |
| `scripting` | Registered script/MAIN-world experiment on granted origins | Remove if JS override is rejected | Decide after test |
| `activeTab` | Temporary access after a gesture | Insufficient for persistent per-site behavior | Normally omit |
| `host_permissions` | Persistent blanket host access | Optional runtime grants | Reject |
| `declarativeNetRequest` | DNR plus implicit block/allow access | WithHostAccess better matches purpose | Reject |

`activeTab` may support a temporary trial, but it is insufficient for remembered profiles across reloads/future navigation. Do not request `declarativeNetRequestFeedback`, `tabs`, `webRequest`, `cookies`, or `debugger`.

Sources: [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions), [`chrome.permissions`](https://developer.chrome.com/docs/extensions/reference/api/permissions), and [`chrome.declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest).
