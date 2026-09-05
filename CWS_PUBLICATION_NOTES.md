# Chrome Web Store Publication Notes / Chrome Web Store 公開メモ

## 日本語

single purpose は「ユーザーが選んだ site の browser identity profile を切り替える」。listing と UI で viewport/device emulation や service 制限回避を主張しない。package 内に全 logic を同梱し、remote code、`eval`、remote configuration、telemetry を使わない。

公開前checklist: Manifest V3、`storage`/DNR/`activeTab`の用途説明、optional host capability envelopeとexact runtime grantの区別、Default/OFFでpermission保持する理由と解放UI、ローカルhost保存のbrowsing-activity disclosure、privacy policy URL、data-use questionnaire、reviewer用Site追加/拒否/削除/OFF手順、icons/screenshots、support URL、source/tag/package再現性、license、依存関係監査、2-step verification。YouTube商標をproduct identityに使わない。

公開可能性はCONDITIONAL。`<all_urls>`やinstall-time host grantを使わず、runtimeに明示hostだけを要求する。manifestの`http://*/*`/`https://*/*` optional envelopeは任意host登録に必要だがgrantではないことをlistingとreview noteで説明する。`scripting`/page patchは不採用。permission denial時の非保存、削除時release、Global OFF時rule全削除を審査で再現可能にする。

根拠: [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)、[Quality guidelines FAQ](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq)、[User data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)。

## English

The single purpose is “switch the browser identity profile for sites selected by the user.” The listing and UI must not claim viewport/device emulation or bypass of service restrictions. Bundle all logic; use no remote code, `eval`, remote configuration, or telemetry.

Before publication verify Manifest V3; explanations for `storage`, DNR, and `activeTab`; the distinction between the optional-host capability envelope and exact runtime grants; retained permission under Default/OFF plus its release UI; browsing-activity disclosure for locally stored hosts; privacy-policy URL; data-use questionnaire; reviewer steps for create/deny/delete/OFF; icons/screenshots; support URL; source/tag/package reproducibility; license; dependency audit; and publisher 2-step verification. Do not use YouTube branding as product identity.

Publishability is CONDITIONAL. Do not use `<all_urls>` or install-time host grants; request only explicit hosts at runtime. Explain that the manifest `http://*/*`/`https://*/*` optional envelope enables arbitrary user-entered hosts but grants nothing by itself. `scripting` and page patching are excluded. Review must reproduce denial without persistence, release after deletion, and removal of all rules under Global OFF.

Sources: [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [Quality guidelines FAQ](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq), and [User data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).
