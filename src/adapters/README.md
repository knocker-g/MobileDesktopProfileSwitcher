# Chrome API Adapters / Chrome API adapter

## English

This directory is the product boundary for Chrome API dependencies. Phase 4 implements `createChromePermissionsAdapter(permissionsApi)`. Phase 5 adds `createChromeDnrAdapter(dnrApi)` for dynamic-rule get/update calls and `createDnrReconciler(...)` as the Phase 3 derived-state port. API objects are injected; adapters never read a Chrome global. Permission request remains outside reconciliation.

Storage, activeTab, event listeners, and service-worker orchestration remain unimplemented. Tests inject minimal fake permissions and DNR APIs rather than a browser-mock framework.

## 日本語

ここはChrome API依存を置く製品境界である。Phase 4の`createChromePermissionsAdapter(permissionsApi)`に加え、Phase 5でdynamic ruleのget/update用`createChromeDnrAdapter(dnrApi)`とPhase 3 derived-state port用`createDnrReconciler(...)`を実装した。API objectを注入しChrome globalを直接読まない。reconcileからpermission requestは行わない。

storage、activeTab、event listener、service worker orchestrationは未実装である。testはbrowser mock frameworkではなく最小fake permissions/DNR APIを注入する。
