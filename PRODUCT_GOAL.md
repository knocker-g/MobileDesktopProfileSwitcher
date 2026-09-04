# Product Goal / プロダクト目標

## 日本語

MobileDesktopProfileSwitcher は、viewport を変えずに、ユーザーが許可したサイトへ固定された browser identity profile を適用し、サイト自身の通常の responsive behavior によって Desktop Web または Mobile Web を選ばせる Manifest V3 Extension である。主対象は Android 上の Chromium 系ブラウザだが、Desktop Chromium でも自然に操作できる設計とする。

成功とは、狭い Android viewport、ログイン状態、Cookie、ページ内容を保ったまま、対象サイトが Desktop Chrome として扱う表示を生成できること。ただし service-specific internal API の client spoof は行わない。

設計原則は simple、predictable、minimum privilege、minimum modification、mobile-friendly、desktop-compatible、auditable、publishable である。現フェーズは仕様・技術調査のみで、Extension は未実装である。

## English

MobileDesktopProfileSwitcher is a Manifest V3 extension that applies a fixed browser identity profile to user-approved sites without changing the viewport, allowing each site’s normal responsive behavior to select Desktop Web or Mobile Web. Android Chromium browsers are the primary target, while the UI must remain natural on desktop Chromium.

Success means producing the site’s Desktop Chrome experience while preserving the narrow Android viewport, login state, cookies, and page content. Service-specific internal API client spoofing is excluded.

The principles are simple, predictable, minimum privilege, minimum modification, mobile-friendly, desktop-compatible, auditable, and publishable. This phase is specification and technical investigation only; the extension is not implemented.
