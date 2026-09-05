# Chrome API Adapters / Chrome API adapter

## 日本語

Chrome API依存を置く製品境界である。Phase 1では未実装。permissions、storage、DNR、activeTab adapterは後続Phaseで追加し、`src/core/`へChrome globalを持ち込まない。

## English

This is the product boundary for Chrome API dependencies and is intentionally empty in Phase 1. Later phases add permissions, storage, DNR, and activeTab adapters without introducing Chrome globals into `src/core/`.
