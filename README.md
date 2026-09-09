# Mobile Desktop Profile Switcher

[日本語](README.ja.md)

Mobile Desktop Profile Switcher (MDPS) is a lightweight Chromium extension that lets users configure a browser identity profile for each registered site: **Default**, **Desktop**, or **Mobile**. The selected profile is automatically applied to matching registered hosts.

MDPS is not a device emulator. Desktop and Mobile profiles change only the `User-Agent` request header for matching top-level navigations. MDPS does not change the viewport or device pixel ratio, emulate touch input, alter JavaScript-visible navigator or platform identity, modify UA Client Hints, or manipulate page content.

## Status

Version 1.0.0 has a complete MVP implementation. The release candidate has passed the consolidated PC Chrome acceptance workflow and actual-device validation with Quetta on Android. These results do not guarantee compatibility with every website or Chromium-based browser.

## Features

- Per-site Default, Desktop, or Mobile profiles
- Multiple explicit hosts grouped into one logical Site
- Automatic application on matching top-level navigation
- Global On/Off without deleting saved Sites or permissions
- Runtime permission grants for exact registered hosts
- Permission-loss detection and a user-initiated recovery flow
- Quick profile switching for the current Site
- Automatic current-page reload after relevant explicit user operations succeed
- Local-only settings, with no telemetry or analytics
- Chromium Manifest V3 architecture

## Site model

One logical Site can contain multiple explicit hosts and has one shared profile. For example:

```text
YouTube
- www.youtube.com
- m.youtube.com
```

YouTube is a tested example, not a service-specific product dependency. MDPS supports explicit hostnames only; it does not rewrite, redirect, or canonicalize page URLs.

## Profiles

### Default

MDPS does not override the Site's `User-Agent`.

### Desktop

The initial Verified Profile Set uses Chrome milestone 152:

```text
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36
```

### Mobile

The initial Verified Profile Set uses Chrome milestone 152:

```text
Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36
```

Desktop and Mobile intentionally use the same verified Chrome milestone. The Profile Set is bundled with each MDPS release: MDPS does not follow the installed browser's major version, fetch a latest UA remotely, or expose arbitrary UA editing.

## How it works

MDPS uses Manifest V3 `chrome.declarativeNetRequest` dynamic rules derived from its locally stored Site settings. It creates one rule per registered and fully permitted host. A rule applies to top-level `main_frame` requests over HTTP or HTTPS and sets only the request `User-Agent` header.

MDPS does not modify subresources, response headers, UA Client Hints, JavaScript identity, or the viewport. It has no content script and performs no redirects.

## Permissions

Required extension permissions:

- `storage`: stores the global state and registered Site settings locally.
- `declarativeNetRequestWithHostAccess`: applies the selected UA profile to permitted hosts.
- `activeTab`: detects the current Site while the user interacts with the popup and reloads that current tab after relevant explicit operations.

The manifest declares the following optional host-permission capability envelope so users can register arbitrary explicit hosts:

```text
http://*/*
https://*/*
```

This does not grant permanent access to every website. When a Site is added, MDPS requests only the exact canonical hostname, as a pair:

```text
https://hostname/*
http://hostname/*
```

MDPS does not request browsing-history access.

## Privacy

MDPS has no telemetry, analytics, external server, or remote configuration. It does not collect browsing history or page content, access cookies, authentication or account data, or sell or share data.

Settings remain in local extension storage. Registered Site information includes canonical hostnames. While the user interacts with the popup, the current tab URL may be processed transiently for current-Site detection; MDPS persists only the canonical hostname needed by a registered Site, not its path, query, or fragment.

## Scope and safety

MDPS is a predictable per-site profile switcher, not a general identity generator or bypass tool. It does not provide custom UA editing, profile rotation, proxy or IP manipulation, cookie or authentication manipulation, CAPTCHA/rate-limit/restriction bypass, service-specific internal API spoofing, fingerprint randomization, page-content manipulation, or viewport/device emulation.

## Installation

Install MDPS from the [Chrome Web Store](https://chromewebstore.google.com/detail/mobile-desktop-profile-sw/ehodmekcjnghcibjjnieleddaibhbilk).

## Development / unpacked installation

To load the current source for development:

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome or a compatible Chromium browser.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select the repository root—the directory containing `manifest.json`.

## Usage

1. Open the target site and then open the MDPS popup.
2. Add the current Site.
3. Add or edit its explicit hosts when necessary.
4. Select Default, Desktop, or Mobile.
5. Grant access to the displayed exact hosts when prompted.
6. MDPS applies the selected profile to matching top-level navigations.

Use the Global switch to suspend or restore all MDPS UA overrides without deleting saved Sites, selected profiles, or retained host permissions.

## Tested environments

- PC Chrome: consolidated MVP acceptance passed.
- Quetta on Android: MVP actual-device validation passed.

Other Chromium-based browsers and devices may differ in Extension API support and website behavior. They are not covered by a blanket compatibility guarantee.

## Known limitations

- Changing the UA does not guarantee that every website will select a different layout.
- Websites may use signals other than the `User-Agent`, and their behavior can change without notice.
- Desktop and Mobile profiles do not emulate complete devices.
- Mobile on a PC keeps the normal PC viewport.
- Desktop on Android keeps the native Android viewport.
- The Profile Set is verified for an MDPS release rather than dynamically synchronized with the installed browser.

## Development and verification

The project uses Node's standard test runner and has no external runtime or test dependencies.

```text
npm test
npm run verify
npm run acceptance:preflight
```

Research probes and investigation material are kept separately under `investigation/` and must be excluded from the production extension package.

Additional design and investigation documents include [Profile Set Policy](PROFILE_SET_POLICY.md), [Site Settings Model](SITE_SETTINGS_MODEL.md), [Permission Lifecycle](PERMISSION_LIFECYCLE.md), [DNR Rule Model](DNR_RULE_MODEL.md), [Storage Model](STORAGE_MODEL.md), and [Acceptance Test Strategy](ACCEPTANCE_TEST_STRATEGY.md).

## License

Licensed under the [MIT License](LICENSE).

Copyright (c) 2026 knocker-g
