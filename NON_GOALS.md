# Non-Goals / 対象外

## 日本語

対象外: viewport/device emulation、Chrome Debugger API/CDP、proxy/IP rotation、Cookie・Authorization・OAuth の変更、CAPTCHA/rate-limit/restriction bypass、fingerprint/UA randomization、自動 rotation、HTTP error を契機にした切替、endpoint 単位の切替、YouTube internal API の `clientName`/`clientVersion`・`visitorData`・youtubei client spoof、Live Chat 取得、continuation 処理、comment overlay/danmaku、ページ内容加工、外部 server、analytics/telemetry、LiveFlow/NicoFlow 連携。

他 Extension の高機能 UA editor、profile import、大量の browser/version catalog は再現しない。別 Extension が同じページで動作することは許容するが、本製品から連携・状態共有・message 通信はしない。

## English

Out of scope: viewport/device emulation; Chrome Debugger API/CDP; proxy/IP rotation; cookie, Authorization, or OAuth changes; CAPTCHA/rate-limit/restriction bypass; fingerprint or UA randomization; automatic rotation; switching in response to HTTP errors; endpoint-level switching; spoofing YouTube internal API `clientName`, `clientVersion`, `visitorData`, or youtubei clients; Live Chat retrieval; continuation processing; comment overlays/danmaku; page-content transformation; external servers; analytics/telemetry; and LiveFlow/NicoFlow integration.

The product will not reproduce a full UA editor, profile importer, or large browser/version catalog. Other extensions may independently run on the same page, but this product will not communicate or share state with them.
