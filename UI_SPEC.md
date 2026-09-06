# UI Specification / UI 仕様

## 日本語

action popupは1カラム、横スクロールなし、主要操作を1画面内に置く。上からproduct name、Global ON/OFF、Current Host、登録状態、現在profile、`Default`/`Desktop`/`Mobile`の大きなprofile選択、`Add current host`または`Apply & Reload`、短いpermission/status文を並べる。

tap target は最低 44×44 CSS px、本文 16px 相当、keyboard focus と visible focus ring、色だけに依存しない状態表示を用いる。Desktop でも popup を不必要に拡大しない（目安 320–400 CSS px）。未対応 URL（`chrome://`、Extension page、file URL 未許可等）では適用ボタンを無効化し理由を示す。

設定画面はGlobal ON/OFF、Site一覧、追加、編集、削除を備える。Site formはSite名、1件以上の明示host一覧、`Default`/`Desktop`/`Mobile`を持つ。各hostにpermission statusと削除操作を表示する。Saveのuser gesture内で新規host分だけpermissionを一括requestし、拒否時はpersist済み設定を変えずdraftと理由を残す。削除時はruleを先に止め、permission cleanup failureを別警告として示す。

### 調査反映後の表示方針

主要なprofile選択は`Default`、`Desktop`、`Mobile`と表示し、Chrome/Windows/Android version、browser brand、任意UA、UA editorを通常設定にしない。必要なら将来、検証済みProfile SetのID/milestoneだけをread-only診断情報として表示できる。Site設定画面では1つのsite名の下に複数の明示hostを表示・追加・削除でき、各hostのoptional permission状態を確認できるようにする。

同一hostが別Siteにある場合は競合Site名を示してSaveを無効化する。URL入力は保存前にhostname previewへ正規化し、scheme/path/query/portを保存しないことを示す。最後のhost削除はSite削除確認へ誘導する。DefaultとGlobal OFFでpermissionを保持すること、Global OFFは設定を消さず全ruleを停止することを明示する。

MVPは`activeTab`で現在のHTTP(S) hostnameだけをprefillする`Add current host`を採用し、手入力も残す。popup即時Site作成は行わず、ユーザーがSite名、host、profile、permission request内容を確認してSaveする。unsupported URLではprefillを無効化し、手入力へ案内する。

PC ChromiumとAndroid Chromiumの両方で、単純な1カラムを基本とするresponsive UI、十分なtap target、keyboard操作、横scrollなしを維持する。一般UA Switcherのような大量のUA/version/OS選択UIは置かない。

UI controllerはChrome APIを直接呼ばずadapter経由とし、状態表示、validation、error、keyboard操作をLevel 1で自動検査する。実popupのpermission promptとresponsive目視はPC consolidated smokeとAndroid final smokeへ各1回だけ集約する。

## English

### Phase 7 Single Popup decision

MVP uses one English-only action popup and no separate Settings/options page. Its internal views are Current Site, collapsed Other Sites, and a shared Add/Edit form. Current Site and its `Default`/`Desktop`/`Mobile` control remain first; Global OFF disables profile application without hiding the saved selection. Unsupported active-tab URLs show `This page cannot be added.` and no full URL or title is persisted.

The popup uses a single-column, width-flexible layout, no viewport-relative sizing, no horizontal scrolling, approximately 44 CSS-pixel controls, 16px inputs, visible keyboard focus, semantic buttons/labels, `aria-pressed`, live status, and alert errors. A bounded desktop width and a narrow-width media rule avoid the self-referential viewport sizing that caused the investigation popup oscillation.

Save synchronously validates with the shared domain model, then invokes exact HTTP/HTTPS permission request as its first asynchronous Chrome effect. Only after request and `contains` post-check succeed does it send the allowlisted runtime commit. Edit requests added hosts only. Grant Access follows the same direct gesture boundary. Deletion uses inline confirmation; permission cleanup warnings do not undo committed deletion.

### Phase 7 Single Popup決定

MVPは英語のみのaction popup 1つを使い、別Settings/options pageを設けない。内部viewはCurrent Site、折りたたみOther Sites、共通Add/Edit formとする。Current Siteと`Default`/`Desktop`/`Mobile`切替を最上位に置き、Global OFF時も保存済み選択を隠さずprofile適用だけを無効化する。未対応active-tab URLでは`This page cannot be added.`を表示し、full URLやtitleを保存しない。

popupは1カラム、可変幅、viewport相対sizeなし、横scrollなし、概ね44 CSS pxのcontrol、16px input、visible keyboard focus、semantic button/label、`aria-pressed`、live status、alert errorを使用する。desktop最大幅と狭幅media ruleにより、調査popupで起きた自己参照的viewport size oscillationを避ける。

Saveは共通domain modelで同期validationし、その直後の最初の非同期Chrome effectとしてexact HTTP/HTTPS permission requestを呼ぶ。requestと`contains` post-check成功後だけallowlist済みruntime commitを送る。Editは追加hostだけをrequestし、Grant Accessも同じ直接gesture境界を使う。削除はinline confirmationとし、permission cleanup warningでcommit済み削除を戻さない。

The action popup is a single column with no horizontal scrolling and all primary actions visible on one screen. It contains the product name, Global ON/OFF, Current Host, registration state, current profile, large `Default`/`Desktop`/`Mobile` choices, `Add current host` or `Apply & Reload`, and a short permission/status message.

Use at least 44×44 CSS-pixel targets, roughly 16px body text, keyboard operation, visible focus rings, and state indicators not based on color alone. Keep the desktop popup compact (about 320–400 CSS px). On unsupported URLs (`chrome://`, extension pages, unapproved file URLs), disable Apply and explain why.

Settings contain Global ON/OFF plus Site list, create, edit, and delete. A Site form contains name, one or more explicit hosts, and `Default`/`Desktop`/`Mobile`. Show permission status and remove action per host. In the Save gesture, request only added-host permissions together. On denial, preserve persisted settings and the draft with an explanation. Stop rules before deletion and report permission-cleanup failure separately.

### Post-investigation presentation

Show `Default`, `Desktop`, and `Mobile` as the primary profile labels. Chrome, Windows, and Android versions, browser brands, arbitrary UA values, and a UA editor are not normal settings. A future diagnostic surface may display only the Verified Profile Set ID or milestone read-only. A Site settings view can show, add, and remove multiple explicit hosts under one site and display each host's optional-permission state.

When a host belongs to another Site, identify the conflicting Site and disable Save. Preview URL input as its normalized hostname and explain that scheme, path, query, and port are not stored. Removing the last host leads to Site deletion confirmation. Explain that Default and Global OFF retain permission, while Global OFF preserves settings and stops every rule.

The MVP uses `activeTab` only to prefill the current HTTP(S) hostname for `Add current host`, with manual input retained. Do not create a Site immediately from the popup; let the user confirm name, host, profile, and requested permission before Save. Unsupported URLs disable prefill and link to manual entry.

UI controllers call Chrome APIs only through adapters so state rendering, validation, errors, and keyboard behavior can be automated at Level 1. Consolidate visual checks of the actual popup and permission prompt into one PC smoke and one Android final smoke.

Use a simple responsive, primarily single-column UI on both desktop and Android Chromium, with adequate tap targets, keyboard access, and no horizontal scrolling. Do not add the large UA/version/OS selection surface of a general UA switcher.
