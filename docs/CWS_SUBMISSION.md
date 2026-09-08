# Chrome Web Store Submission Copy — Mobile Desktop Profile Switcher v1.0.0

Internal release document. Verify all fields against the Chrome Web Store dashboard immediately before submission because field names and disclosure categories may change.

## Publication blockers

- **Privacy Policy URL:** `NOT YET AVAILABLE`. After the initial public repository push, the published `PRIVACY.md` is a candidate. Confirm that the final URL and presentation satisfy the current CWS requirements.
- **Support URL:** `https://github.com/knocker-g/MobileDesktopProfileSwitcher` — `TO BE VERIFIED AFTER INITIAL PUSH`. Do not submit it while the repository is empty or unavailable.
- **CWS Privacy Practices selections:** `VERIFY IN CWS UI BEFORE SUBMISSION`, especially the current definition and presentation of browsing activity and user activity.

## Listing copy

### Product name

Mobile Desktop Profile Switcher

### Short description

Switch between Default, Desktop, and Mobile browser identity profiles for each site.

### Detailed description

Mobile Desktop Profile Switcher is a lightweight Chromium extension for choosing a browser identity profile for each registered site.

Choose Default, Desktop, or Mobile for a logical Site containing one or more explicit hostnames. MDPS automatically applies the selected profile when you navigate to a matching registered host. The popup also provides quick profile switching for the current site, a Global On/Off control, permission recovery, and Site editing and removal.

MDPS requests site access only for the exact hostnames that you explicitly register. Configuration remains in local extension storage, and the extension includes no telemetry, analytics, remote configuration, or developer-operated data service.

Desktop and Mobile profiles change only the User-Agent request header for matching top-level navigations. MDPS is not a device emulator: it does not change the viewport, device pixel ratio, touch input, JavaScript-visible identity, UA Client Hints, or page content. Default applies no MDPS User-Agent override.

Website behavior may depend on signals other than User-Agent, so changing a profile does not guarantee that every website will change its layout.

## Single purpose

Allow users to choose and automatically apply a Default, Desktop, or Mobile browser identity profile for explicitly registered sites.

## Permission justifications

Use the following text in the applicable dashboard fields, adjusted only if the current CWS field imposes a shorter length limit.

### `storage`

Stores registered Sites, user-defined Site names, canonical hostnames, selected profiles, the global enabled state, and internal rule and recovery metadata in local extension storage. These settings are required to restore and safely reconcile the user's configuration across extension service-worker restarts.

### `declarativeNetRequestWithHostAccess`

Applies the user-selected Desktop or Mobile User-Agent request header to top-level navigations for user-approved registered hosts. Default applies no User-Agent override. Rules are dynamic, limited to matching main-frame requests, and derived from locally stored settings and current host permissions.

### `activeTab`

Used only while the user explicitly interacts with the extension popup to detect the current site/hostname and to reload the current tab after a relevant explicit operation has successfully updated the profile, rules, or permission state. MDPS does not use this permission for continuous tab monitoring or browsing-history collection.

### Optional host permissions: `http://*/*` and `https://*/*`

These optional patterns are the capability envelope that allows a user to register a hostname of their choice. They do not grant MDPS install-time access to every website. When the user saves or grants access for a Site, MDPS requests runtime permission only for each exact canonical hostname as `https://hostname/*` and `http://hostname/*`. It does not request wildcard subdomains or unrelated Site access.

## Remote code declaration

**Proposed answer:** No remote code.

MDPS includes no remote JavaScript, CDN script, downloaded executable code, remotely loaded WebAssembly, `eval`, `new Function`, or remote configuration. All executable extension code is bundled in the submitted package.

`VERIFY IN CWS UI BEFORE SUBMISSION`: confirm the current wording of the declaration and select the option equivalent to no remotely hosted code.

## Privacy Practices / Data Use draft

The CWS form and its category definitions can change. Map the implementation facts below to the exact current questions; do not rely only on the labels in this document.

| Data category | Proposed disclosure | Implementation basis |
| --- | --- | --- |
| Personally identifiable information | No | MDPS does not request or store names tied to a person, email addresses, user IDs, or other personal identifiers. A Site display name describes a site, not the user. |
| Health information | No | Not accessed, stored, or transmitted. |
| Financial or payment information | No | Not accessed, stored, or transmitted. |
| Authentication information | No | MDPS has no cookies permission and does not access credentials, authentication tokens, or account data. |
| Personal communications | No | MDPS does not read page content, messages, comments, email, or other communications. |
| Location | No | MDPS does not access location data. |
| Web history / browsing activity | **Disclose conservatively / Yes if the form treats local handling as collection** | MDPS transiently processes the active tab URL/hostname during popup interaction and locally stores explicitly registered canonical hostnames. It does not enumerate or retain browsing history, and it does not transmit these values. `VERIFY IN CWS UI BEFORE SUBMISSION`. |
| Website content | No | MDPS does not read or collect DOM content, page text, form content, request bodies, or response bodies. It changes only the top-level request User-Agent header. |
| User activity | No collection for analytics or behavioral tracking | MDPS responds to explicit popup controls but does not log, profile, or transmit clicks, keystrokes, scrolling, or interaction history. `VERIFY IN CWS UI BEFORE SUBMISSION` against the current category definition. |
| Analytics | No | No analytics library, endpoint, event logging, or telemetry. |
| Advertising | No | No advertising code, identifiers, personalization, or measurement. |

### Storage and transmission qualification

- Registered canonical hostnames and related Site settings are processed and stored locally because they are necessary for the extension's single purpose.
- The current tab URL/hostname is processed transiently during popup interaction; only a canonical hostname explicitly registered by the user is persisted.
- MDPS does not transmit this information to the developer or third parties.
- Normal browser-to-website traffic remains outside this claim. MDPS may modify the User-Agent header of a matching top-level request, but it creates no additional developer or analytics request.

### Limited Use statements

Proposed certifications, subject to the exact current CWS wording:

- Information received from Chrome APIs is used only to provide or improve the extension's clearly disclosed single purpose.
- Data is not sold or transferred to third parties.
- Data is not used for advertising, behavioral profiling, or purposes unrelated to the single purpose.
- Data is not used to determine creditworthiness or for lending.
- Humans do not read user data because MDPS does not transmit it to the developer and provides no developer-operated backend.
- Data is not transferred except where necessary to provide the extension's stated functionality; the current implementation performs no developer-directed or third-party data transfer.

`VERIFY IN CWS UI BEFORE SUBMISSION`: compare every certification with the exact current Limited Use language before accepting it.

## Reviewer instructions

No account or special credentials are required.

1. Install the extension and open a normal reviewer-selected HTTP or HTTPS page.
2. Open the extension popup. Confirm that the current hostname is shown, then activate the current-site row to open Add Site.
3. Enter a Site name, keep or edit the explicit hostname, choose Default, Desktop, or Mobile, and save.
4. Confirm that Chrome asks for access to the registered hostname rather than granting install-time access to all websites. Grant access.
5. In the Current Site section, change among Default, Desktop, and Mobile. After a successful change, MDPS reloads the current page. A visible layout change is not guaranteed because websites may use signals other than User-Agent.
6. Optionally, use DevTools Network to inspect the main document request. Desktop and Mobile set their bundled User-Agent values; Default applies no MDPS User-Agent override. Subresources are not modified.
7. Turn Global Off and On. Off preserves the Site and selected profile while disabling active MDPS rules; On restores eligible rules without requesting unrelated access.
8. In Sites, remove the registered Site using the inline confirmation. Confirm that it is no longer registered.

## Support and contact plan

- **Developer-public support/contact email:** `knocker.dev@gmail.com`.
- The GitHub noreply commit identity must not be presented as a support address.
- Use `knocker.dev@gmail.com` in the Privacy Policy and the relevant CWS support/contact fields.
- **Proposed support URL:** `https://github.com/knocker-g/MobileDesktopProfileSwitcher` — `TO BE VERIFIED AFTER INITIAL PUSH`.
- After the repository is publicly available, verify that the URL resolves, that issue/support expectations are clear, and that it meets the current CWS support URL requirements.

## Privacy Policy URL plan

- **Current status:** `NOT YET AVAILABLE` — release blocker.
- Candidate after the initial public push: the publicly rendered `PRIVACY.md` in the GitHub repository.
- Before submission, confirm that the chosen URL is publicly accessible without authentication and satisfies the current CWS Privacy Policy URL and presentation requirements.

## Final dashboard verification checklist

- Confirm the product name and short/detailed descriptions against the packaged manifest and public README.
- Confirm Single Purpose text.
- Paste and recheck every permission justification.
- Select the no-remote-code declaration matching the current UI.
- Disclose browsing activity conservatively based on local registered-hostname storage and transient current-tab URL processing.
- Re-evaluate the current definition of user activity.
- Confirm all Limited Use certifications against the current wording.
- Replace every `NOT YET AVAILABLE` and `TO BE VERIFIED AFTER INITIAL PUSH` marker.
- Verify the public support/contact email, Support URL, and Privacy Policy URL.
- Confirm required listing assets and screenshots separately before submission.
