# Chrome API Adapters / Chrome API adapter

## English

This directory is the product boundary for Chrome API dependencies. Phase 4 implements only `createChromePermissionsAdapter(permissionsApi)`. Its injected API exposes `contains`, `request`, and `remove`; the adapter never reads a Chrome global, automatically requests permission, or accepts host input. Exact-origin planning and validation remain in `src/core/`.

Storage, DNR, activeTab, event listeners, and service-worker orchestration remain unimplemented. Tests inject a minimal fake permissions API rather than a browser-mock framework.

## 日本語

ここはChrome API依存を置く製品境界である。Phase 4では`createChromePermissionsAdapter(permissionsApi)`だけを実装した。注入APIの`contains`、`request`、`remove`を利用し、Chrome globalを直接読まず、permissionを自動要求せず、host入力も受け取らない。exact originのplanとvalidationは`src/core/`に置く。

storage、DNR、activeTab、event listener、service worker orchestrationは未実装である。testはbrowser mock frameworkではなく最小fake permissions APIを注入する。
