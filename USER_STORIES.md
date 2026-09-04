# User Stories / ユーザーストーリー

## 日本語

- ユーザーは現在の site を一目で確認し、Default または Desktop Chrome を大きな tap target で選べる。
- ユーザーは明示操作で現在 origin の permission を許可し、profile を記憶して reload できる。
- ユーザーは一時適用を選び、永続 site 設定を増やさず試せる。
- ユーザーは保存済み origin と profile を確認し、個別に削除できる。
- ユーザーは global default を設定できるが、未許可 origin へ暗黙の host access は与えない。
- ユーザーは Default に戻すことで変更 rule と page override を外し、reload できる。

受入条件: viewport は変えない、ログイン情報を触らない、無許可 site を変更しない、適用前後と permission 状態を明示する、失敗時に成功表示しない。

## English

- A user can see the current site and select Default or Desktop Chrome using large tap targets.
- Through an explicit gesture, a user can grant the current origin, remember a profile, and reload.
- A user can try a temporary application without adding a persistent site setting.
- A user can inspect saved origins and profiles and remove each entry.
- A user can set a global default, but it never creates implicit host access for ungranted origins.
- Selecting Default removes applicable rules/page overrides and reloads.

Acceptance criteria: never change the viewport or login data; never modify an ungranted site; clearly show profile and permission state; never report success when application failed.
