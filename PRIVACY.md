# Privacy Policy for Mobile Desktop Profile Switcher

[日本語](PRIVACY.ja.md)

Effective date: September 8, 2026

Mobile Desktop Profile Switcher (MDPS) is a Chromium extension that applies a user-selected Default, Desktop, or Mobile browser identity profile to explicitly registered sites. This policy explains the information MDPS processes and how that information is handled.

## Information processed

When you interact with the extension popup, MDPS may temporarily process the active tab URL and hostname to identify the current site, match it to a registered Site, and reload that tab after a relevant explicit operation.

MDPS stores the following configuration in `chrome.storage.local`:

- user-defined Site names;
- canonical hostnames explicitly registered for each Site;
- the selected Default, Desktop, or Mobile profile;
- the global enabled or disabled state; and
- internal identifiers and schema, revision, rule, and recovery metadata needed to apply settings consistently and recover safely after an interrupted update.

MDPS does not persist the active tab's path, query, fragment, page title, or a browsing-history log. A registered Site stores only the canonical hostname derived from the host or URL that the user chooses to register.

## How information is used

The information above is used only to provide MDPS's single purpose: applying the selected browser identity profile to explicitly registered hosts, showing the applicable configuration in the popup, managing the required site permissions, and recovering the configured state safely.

For Desktop and Mobile profiles, MDPS changes only the `User-Agent` request header on matching top-level navigations. Default does not apply a User-Agent override.

## Information not collected

MDPS does not collect:

- a browsing-history log;
- page content;
- cookies;
- authentication credentials or account information;
- personal communications;
- payment, financial, health, or precise location information;
- advertising identifiers; or
- analytics or telemetry.

## Data transmission

MDPS has no developer-operated server, telemetry endpoint, analytics endpoint, advertising endpoint, or remote configuration service. The extension does not transmit stored Site configuration to the developer or to third parties.

This statement concerns network requests added by MDPS itself. It does not describe or alter the normal communications between your browser and websites that you choose to visit. When an enabled Desktop or Mobile profile applies, MDPS modifies the `User-Agent` header on the applicable top-level website request; it does not create an additional request to the developer or another service.

## Storage and retention

Configuration remains in local extension storage in the applicable browser profile. MDPS does not use Chrome sync storage. Data remains until you edit or remove the applicable Site configuration, clear the extension's local data through the browser, or the browser otherwise removes that extension data.

## Permissions

MDPS uses these permissions:

- **`storage`** stores registered Sites, selected profiles, the global enabled state, and internal rule and recovery metadata locally.
- **`declarativeNetRequestWithHostAccess`** applies the selected Desktop or Mobile `User-Agent` header to top-level navigation requests for user-approved registered hosts.
- **`activeTab`** reads the current site while you interact with the popup and reloads the current tab after relevant explicit operations.
- **Optional HTTP and HTTPS host access** allows you to register a hostname of your choice. MDPS requests access at runtime only for the exact canonical hostname being registered, using both `https://hostname/*` and `http://hostname/*`. It does not receive install-time access to every website.

## Sharing, sale, advertising, and profiling

MDPS does not sell data, share data with third parties, use data for advertising, build advertising or user profiles, or use information for creditworthiness or lending purposes. Information obtained through Chrome APIs is used only to provide the extension's stated single purpose and in accordance with the Chrome Web Store User Data Policy, including its Limited Use requirements.

## Your controls

You can edit or remove registered Sites from the popup. You can revoke a Site's host permission through the browser and grant it again through an explicit action in MDPS. Global Off removes active MDPS dynamic rules while preserving saved Site settings, selected profiles, and granted permissions so they can be restored when you turn MDPS on again.

## Changes to this policy

This policy may be updated when MDPS functionality or applicable requirements change. Material changes will be reflected in the published policy and its effective date.

## Contact

knocker.dev@gmail.com
