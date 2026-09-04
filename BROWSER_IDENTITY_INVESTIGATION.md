# Browser Identity Investigation / browser identity 技術調査

## 日本語

### 結論

通常 navigation を Desktop Chrome として認識させる最小候補は、許可 origin に対する `User-Agent` request header の固定値化である。ただし UA-CH と JavaScript-visible identity が Android を示し続ける可能性があり、YouTube Desktop Web + Native Live Chat の成立条件は未確定。専用の「browser profile override」Extension API はないため、現時点は CONDITIONAL GO とする。

| 項目 | 表すもの | 標準 Extension 手段 | MV3 | 初期判断 |
|---|---|---|---|---|
| `User-Agent` header | server-side legacy UA | DNR `modifyHeaders`/`set` | 可 | A/B の最小候補 |
| `Sec-CH-UA` | browser brands/major versions | DNR の一般 header `set` を実機検証 | API上は候補 | 整合性試験後のみ |
| `Sec-CH-UA-Mobile` | mobile boolean | 同上 | 候補 | `?0` の必要性を試験 |
| `Sec-CH-UA-Platform` | platform brand | 同上 | 候補 | `"Windows"` の必要性を試験 |
| high entropy UA-CH headers | fullVersionList、architecture、bitness、model、platformVersion 等 | Accept-CH、secure context、browser policy に依存。汎用的な整合 API なし | 部分的/要検証 | MVPで推測追加しない |
| `navigator.userAgent` | JS legacy UA | MAIN-world property override は技術上候補 | 可だが fragile | 必要性が出た場合のみ |
| `navigator.appVersion` | legacy UA-derived string | 同上 | 候補 | UA と同時に要試験 |
| `navigator.platform` | legacy platform (`Win32`) | 同上 | 候補 | 必要性が出た場合のみ |
| `navigator.vendor` | vendor (`Google Inc.`) | 同上 | 候補 | 通常 Chromium と同値なら不要 |
| `navigator.product` | legacy product (`Gecko`) | 同上 | 候補 | 通常同値なら不要 |
| `navigator.userAgentData` | low/high entropy UA-CH API | MAIN-world facade/descriptor patch が必要 | 専用 API なし | 公開 MVP では高リスク |
| WorkerNavigator identity | Worker 内 identity | page worker より前の網羅的 patch が困難 | 信頼できる標準手段なし | 対象外/既知漏れ |
| `oscpu` | 非標準/主に Gecko 系 | Chromium では基準にしない | 不要 | 除外 |

UA-CH は `Sec-CH-UA`、`Sec-CH-UA-Mobile`、`Sec-CH-UA-Platform` と `navigator.userAgentData` の対応関係を持つ。header だけ変更すると JS 値と矛盾する。high entropy 値は server の `Accept-CH` や secure context、Permissions Policy に関係し、`getHighEntropyValues()` は Window と Worker に露出する。DNR で見える request header を設定できても、browser 内部の UA metadata 全体を変更したことにはならない。

### Top-level と subresource

`main_frame` だけへの `User-Agent` 適用は最小だが、同じ document が生成する first-party fetch/XHR や iframe で server-side client selection が再評価される場合、不整合が起きる。これは service-specific payload spoof とは別である。実験順は (1) `main_frame` のみ、(2) 同一 origin の通常 subresource へ同じ browser-level header set、の順とし、必要性を network log で確認する。cross-origin third-party、YouTube internal API payload/body、client identifiers は変更しない。

### MAIN world

`world: "MAIN"` と `run_at: "document_start"` は page script より早い注入候補だが、page と同じ world のため改変・検知され得る。`executeScript({injectImmediately:true})` は既に page load 済みなら先行を保証しない。採用するなら登録 content script を permission grant 済み origin に限定し、値のみを返す小さな patch とする。それでも Worker、既に取得済み descriptor、browser 内部 UA-CH metadata の完全整合は保証できない。

### 最小 A/B test

同一端末・同一 account・同一 viewport で各条件を fresh tab から5回実施する: A=Default、B=`User-Agent` main_frame、C=`User-Agent` 同一 origin request、D=C+low-entropy UA-CH、E=D+最小 MAIN-world legacy navigator。記録は表示種別、Native Live Chat 成否/error、request headers、page/worker identity dump、login 維持、console error。Chrome 154 fixture と実端末 browser version の組合せも分離する。成功を推測で確定しない。

根拠: [`chrome.declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)、[`chrome.scripting`](https://developer.chrome.com/docs/extensions/reference/api/scripting)、[Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)、[UA Client Hints specification](https://wicg.github.io/ua-client-hints/)、[Chrome UA-CH guide](https://developer.chrome.com/docs/privacy-security/user-agent-client-hints)。

## English

### Conclusion

The smallest candidate for desktop recognition during normal navigation is a fixed `User-Agent` request header on a granted origin. UA-CH and JavaScript-visible identity may still reveal Android, so the requirement for YouTube Desktop Web plus Native Live Chat remains unproven. There is no dedicated extension “browser profile override” API; current status is CONDITIONAL GO.

The table above maps directly as follows: legacy UA header is DNR-capable; low-entropy UA-CH headers are testable DNR candidates; high-entropy metadata lacks a general consistency API; legacy `navigator` values require a fragile MAIN-world override; `navigator.userAgentData` requires a facade-like patch; WorkerNavigator cannot be reliably covered with supported MV3 mechanisms; `oscpu` is excluded.

Applying only to `main_frame` is minimal, but same-document first-party fetch/XHR or frames may trigger server-side selection again. Test main frame first, then the same header set on same-origin requests only when evidence requires it. Never modify cross-origin third-party requests, request bodies, YouTube internal API payloads, or client identifiers.

`world: "MAIN"` at `document_start` is the earliest supported content-script candidate, but it shares the page world and can be observed or interfered with. `injectImmediately` does not guarantee execution before an already-started page. If needed, use a registered, tiny, value-only patch limited to granted origins. It still cannot guarantee Worker or browser-internal UA metadata consistency.

Run the five-condition A/B matrix described above on the same device/account/viewport, five fresh-tab runs per condition. Record UI variant, Native Live Chat result/error, request headers, page/worker identity, login continuity, and console errors. Separate the Chrome 154 fixture question from the actual browser-version question. Do not infer success.

Sources: [`chrome.declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest), [`chrome.scripting`](https://developer.chrome.com/docs/extensions/reference/api/scripting), [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [UA Client Hints specification](https://wicg.github.io/ua-client-hints/), and [Chrome UA-CH guide](https://developer.chrome.com/docs/privacy-security/user-agent-client-hints).
