# Technical Investigation Plan / 技術調査計画

## 日本語

### Gate 1: API capability

最小の unpacked MV3 test fixture（製品実装ではない）で、対象 browser ごとに DNR `set` が `User-Agent`、`Sec-CH-UA`、`Sec-CH-UA-Mobile`、`Sec-CH-UA-Platform` へ実際に反映されるか確認する。`main_frame`、same-origin subresource、cross-origin を分け、DevTools と echo endpoint の双方で観測する。optional host permission の grant/revoke と dynamic rule cleanup も確認する。

合格: documented API のみで値が安定し、revoke 後に影響が残らない。不合格: Android browser で API 不在、header が保護され変更不能、rule が許可範囲外へ漏れる。

### Gate 2: identity matrix

各 condition で HTTP headers、`navigator.userAgent`、`appVersion`、`platform`、`vendor`、`product`、`userAgentData` low/high entropy、Window と dedicated/shared/service Worker を採取する。目的は fingerprint 完全偽装ではなく、どの surface が site selection に実際に寄与するかの切り分け。

### Gate 3: product outcome

Sony Xperia 1 V + Quetta Android + YouTube で、同じ account/cookies/viewport を用い、Default と A〜E 条件を fresh navigation から各5回比較する。Desktop Web、Native Live Chat、login、別 Extension の通常動作、error text、network/console を記録する。YouTube payload は観測のみで変更しない。

### Gate 4: minimum modification

成功した条件から一要素ずつ除く ablation test を行う。`User-Agent` のみで成立すれば UA-CH と MAIN-world を採用しない。same-origin subresource が不要なら `main_frame` のみに絞る。MAIN-world が必要なら legacy navigator と `userAgentData` を別々に評価し、Worker の漏れが機能を壊すなら NO-GO。

### Gate 5: compatibility and policy

Desktop Chrome、Quetta Android の version を固定記録し、cold start、service worker restart、browser restart、profile update、permission revoke、site redirect、subdomain、incognito off、競合 Extension の rule ordering を確認する。CWS の single purpose、minimum permission、remote code、privacy disclosure を review checklist にする。

### 判定基準

- GO: supported API、optional origin grant、DNR 中心で再現性ある成果。MAIN-world 不要または極小で、CWS 説明可能。
- CONDITIONAL GO: MAIN-world または same-origin subresource 整合が必要だが、限定的・監査可能で追加試験が明確。
- NO-GO: unsupported API、CDP、service-specific payload、広範 worker/page patch、過剰 host permission が必須。または Native Live Chat 成果を再現できない。

成果物は test matrix、raw observation（secret を除外）、browser/version、rule scope、差分、最終 fixture、未解決事項。推測値を合格扱いしない。

## English

### Gate 1: API capability

Using a minimal unpacked MV3 test fixture—not product implementation—verify per browser whether DNR `set` actually changes `User-Agent`, `Sec-CH-UA`, `Sec-CH-UA-Mobile`, and `Sec-CH-UA-Platform`. Separate `main_frame`, same-origin subresources, and cross-origin requests; observe with both DevTools and an echo endpoint. Validate optional-host grant/revoke and dynamic-rule cleanup.

Pass when documented APIs behave consistently and revocation leaves no effect. Fail when the Android browser lacks the API, protects required headers, or leaks rules outside granted scope.

### Gates 2–5

Capture the HTTP and JavaScript identity matrix across Window and Worker contexts. Run Default and A–E conditions five times each on Sony Xperia 1 V, Quetta Android, and YouTube with the same account, cookies, and viewport. Observe but never alter YouTube payloads. Then perform ablation: remove every element that is not necessary. Validate desktop Chrome/Quetta versions, cold starts, extension-worker/browser restarts, permission revocation, redirects, subdomains, incognito-off behavior, and competing extension rule order. Review CWS single-purpose, minimum-permission, remote-code, and privacy requirements.

GO requires supported APIs, optional origin grants, reproducible DNR-centered results, and explainable CWS behavior. CONDITIONAL GO permits only bounded, auditable MAIN-world or same-origin consistency work with explicit further tests. NO-GO applies when unsupported APIs, CDP, service payload changes, broad Worker/page patching, excessive host access, or irreproducible Native Live Chat behavior is required.

Record the test matrix, secret-free raw observations, browser/version, rule scope, diffs, final fixture, and unresolved items. Never treat guessed values as passing evidence.
