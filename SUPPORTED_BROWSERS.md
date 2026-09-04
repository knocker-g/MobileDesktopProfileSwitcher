# Supported Browsers / 対応ブラウザ

## 日本語

| 区分 | 方針 |
|---|---|
| Chrome Desktop | 開発・基準検証対象。Manifest V3 と必要 API の基準実装 |
| Quetta Android | 主な実機検証対象。ただし Chrome Extension API 互換性は要実機確認 |
| その他の Android Chromium | 未検証。Extension、`declarativeNetRequest`、optional host permission、MAIN world の実装差があり得る |
| Edge/Brave/Vivaldi 等 | 将来の互換性確認対象。MVP の保証対象外 |
| Firefox/Safari | 対象外 |

「Chromium ベース」は API と動作の完全互換を意味しない。Chrome の最小 version は実験後に固定し、それ以前を推測で保証しない。Quetta では Sony Xperia 1 V を初期検証端末とする。

## English

| Class | Policy |
|---|---|
| Desktop Chrome | Development and reference validation target; baseline Manifest V3 implementation |
| Quetta Android | Primary device-test target; Chrome Extension API compatibility requires device validation |
| Other Android Chromium | Unverified; extension, `declarativeNetRequest`, optional host permission, and MAIN-world behavior may differ |
| Edge/Brave/Vivaldi, etc. | Future compatibility targets, not guaranteed for MVP |
| Firefox/Safari | Out of scope |

“Chromium-based” does not guarantee API or behavioral compatibility. The minimum Chrome version will be fixed after experiments, not guessed. Sony Xperia 1 V is the initial Quetta test device.
