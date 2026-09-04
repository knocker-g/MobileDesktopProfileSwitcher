# Chrome Web Store Publication Notes / Chrome Web Store 公開メモ

## 日本語

single purpose は「ユーザーが選んだ site の browser identity profile を切り替える」。listing と UI で viewport/device emulation や service 制限回避を主張しない。package 内に全 logic を同梱し、remote code、`eval`、remote configuration、telemetry を使わない。

公開前 checklist: Manifest V3、permission の用途説明、optional origin grant、privacy policy URL、ローカル origin 保存の disclosure、data-use questionnaire の整合、icons/screenshots、support URL、GitHub source/tag と store package の再現性、license、依存関係監査、全 feature の review 手順、2-step verification。YouTube 商標を product identity に使わず、検証例としての記載も誤認を避ける。

公開可能性は CONDITIONAL。狭い single purpose と optional permissions は適合方向だが、MAIN-world spoof の範囲、説明可能性、実効性、審査時の挙動が gate。不要なら `scripting` と page patch を削除するのが望ましい。

根拠: [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)、[Quality guidelines FAQ](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq)、[User data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)。

## English

The single purpose is “switch the browser identity profile for sites selected by the user.” The listing and UI must not claim viewport/device emulation or bypass of service restrictions. Bundle all logic; use no remote code, `eval`, remote configuration, or telemetry.

Before publication verify Manifest V3, permission explanations, optional origin grants, privacy-policy URL, disclosure of locally stored origins, data-use questionnaire consistency, icons/screenshots, support URL, reproducibility between GitHub tag and store package, license, dependency audit, reviewer instructions for every feature, and publisher 2-step verification. Do not use YouTube branding as product identity or imply affiliation.

Publishability is CONDITIONAL. The narrow purpose and optional permissions are favorable, but the scope, explainability, effectiveness, and review behavior of MAIN-world spoofing are gates. Prefer removing `scripting` and page patching if tests show they are unnecessary.

Sources: [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [Quality guidelines FAQ](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq), and [User data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).
