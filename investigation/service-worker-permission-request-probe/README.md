# Service Worker Permission Request Probe

This isolated Manifest V3 extension tests one question: can a popup click synchronously send a runtime message whose service-worker handler successfully starts `chrome.permissions.request()` and continues after the browser permission UI closes the popup?

It requests only `https://example.com/*`. The popup never calls `chrome.permissions.request()` directly. After the service worker observes both a successful request result and `permissions.contains() === true`, it records durable browser-owned evidence by setting the action badge to `OK`. Reopening the popup queries the service worker and the badge.

The manifest deliberately uses an empty `permissions` list. Chrome exposes `chrome.permissions` for optional permissions declared by the extension; there is no named Chrome manifest permission called `permissions` to add.

Run the static check with:

```text
node investigation/service-worker-permission-request-probe/verify.mjs
```

This probe is investigation-only. Do not package it with the production extension.
