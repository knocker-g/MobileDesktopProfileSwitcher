# User Stories / ユーザーストーリー

## 日本語

- ユーザーは現在hostを一目で確認し、登録済みSiteの`Default`、`Desktop`、`Mobile`を大きなtap targetで選べる。
- ユーザーは現在hostをSite formへprefillし、明示操作でexact host permissionを許可して保存・reloadできる。
- ユーザーは1つのSiteに複数の明示hostを登録し、1つのprofileを一括適用できる。
- ユーザーは保存済みSite、host、profile、permission状態を確認し、編集・削除・permission解放できる。
- ユーザーはGlobal OFFで全identity変更を止め、設定とpermissionを保持したまま後でONへ戻せる。
- ユーザーはSiteをDefaultへ戻し、host groupとpermissionを維持したままruleを外してreloadできる。

受入条件: viewport は変えない、ログイン情報を触らない、無許可 site を変更しない、適用前後と permission 状態を明示する、失敗時に成功表示しない。

## English

- A user can see the current host and choose `Default`, `Desktop`, or `Mobile` for its registered Site using large tap targets.
- A user can prefill the current host into a Site form, explicitly grant exact host permission, save, and reload.
- A user can register multiple explicit hosts under one Site and apply one profile to all of them.
- A user can inspect and edit saved Sites, hosts, profiles, and permission state, or delete and release permission.
- A user can use Global OFF to stop every identity change while retaining settings and permission for later ON.
- A user can return a Site to Default, remove its rule, and reload while preserving its host group and permission.

Acceptance criteria: never change the viewport or login data; never modify an ungranted site; clearly show profile and permission state; never report success when application failed.
