# PC Acceptance Checklist

## English

### Purpose and result rule

Run this once on Desktop Chrome Stable against the unpacked product extension. The preflight proves static, permission, Profile Set, and DNR-shape contracts; this session covers only browser UI, prompt presentation, real YouTube behavior, three bounded main-document UA observations, persistence, and external revocation. Do not load an investigation probe, clear cookies, sign out, or inspect UA-CH/subresources/JavaScript identity.

If every required item passes, report only:

```text
PC Acceptance: PASS
```

At the first failure, stop and report only:

```text
Failed step: <number>
Observed: <short description>
```

`SKIP` is allowed only for optional Live Chat or a site-access release check that Chrome does not expose simply. All other steps are required.

Optional local session record (do not send it when everything passes):

| Step | Status (`PASS` / `FAIL` / allowed `SKIP`) |
|---|---|
| 1 Load |  |
| 2 Popup |  |
| 3 Register |  |
| 4 Desktop |  |
| 5 Desktop UA |  |
| 6 Mobile + UA |  |
| 7 Default + native UA |  |
| 8 Global OFF/ON |  |
| 9 Popup reopen |  |
| 10 Extension reload |  |
| 11 Revoke/regrant |  |
| 12 Edit/delete |  |

### Before the browser session

1. Open PowerShell in the repository root.
2. Run `npm.cmd run verify` and require `VERIFY PASS`.
3. Run `npm.cmd run acceptance:preflight` and require `ACCEPTANCE PREFLIGHT PASS 15/15`.
4. Run `git status --short` and require no output.

Stop if any command fails or the working tree is not clean.

### One consolidated Chrome session

#### 1. Load the extension

1. Open `chrome://extensions`.
2. Turn **Developer mode** on.
3. Click **Load unpacked**.
4. Select the `MobileDesktopProfileSwitcher` repository root.
5. Confirm the MDPS card appears without an error banner.
6. Open the Extensions menu and pin **MobileDesktopProfileSwitcher**.

Stop if Chrome reports a manifest/service-worker error or an unexpected install-time all-sites warning.

#### 2. Check the popup and current site

1. Open `https://www.youtube.com/` in a normal tab.
2. Click the pinned MDPS icon.
3. Confirm the popup is stable, has no horizontal scrollbar, and does not oscillate in size.
4. Confirm **Current site** is `www.youtube.com`, Global is **ON**, and **Add this site** appears.

#### 3. Register the YouTube Site

1. Click **Add this site**.
2. Replace Name with `YouTube`.
3. Keep `www.youtube.com` as the first host.
4. Click **+ Add host**.
5. Enter `m.youtube.com` in the second host.
6. Select **Desktop**.
7. Click **Save** once.
8. In Chrome's permission prompt, confirm it concerns the two explicit YouTube hosts and is not unrestricted access to every site; then click **Allow**.
9. Confirm the popup returns to Current Site and shows **Desktop** selected.

Stop on denial, a broad all-sites prompt, partial save, or an error message.

#### 4. Desktop functional check

1. Close the popup.
2. Open a YouTube video or available live page as a fresh navigation, or reload the current YouTube page.
3. Confirm Desktop Web, normal PC viewport, retained login, video playback, and no old-browser warning.
4. If the chosen page has native Live Chat, confirm the chat and input are visible; otherwise mark only this Live Chat item `SKIP (no live page)`.

#### 5. One Desktop wire check

1. Press **F12** and open **Network**.
2. Select the **Doc** filter if available.
3. Reload the YouTube page once.
4. Select the main document request.
5. Under **Request Headers**, confirm only this expected value:

```text
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36
```

Do not inspect UA-CH, subresources, or navigator values. Leave DevTools open for the next two bounded checks.

#### 6. Mobile functional and wire check

1. Click the MDPS icon and click **Mobile** once.
2. Close the popup and reload/navigate the YouTube page.
3. Confirm Mobile Web, unchanged PC viewport, retained login, video playback, and no old-browser warning. A YouTube-driven move from `www.youtube.com` to `m.youtube.com` is expected.
4. In Network, select the new main document request.
5. Confirm:

```text
User-Agent: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36
```

Mobile Web hiding native Live Chat is expected and is not a failure.

#### 7. Default recovery and final wire check

1. Click the MDPS icon and click **Default**.
2. Reload/navigate YouTube.
3. Confirm Chrome's normal presentation returns.
4. Select the new main document request in Network.
5. Confirm User-Agent is Chrome's own native value and is neither MDPS Chrome 152 fixture above. Do not require a particular native version.
6. Close DevTools. No further wire capture is required.

#### 8. Global OFF and ON

1. Open MDPS, select **Desktop**, close the popup, and reload YouTube; confirm Desktop Web.
2. Open MDPS and click Global **ON** so it becomes **OFF**.
3. Confirm **Desktop selected — Global OFF** remains visible and Profile selects are disabled.
4. Close the popup and reload YouTube; confirm the MDPS override is stopped.
5. Open MDPS and click Global **OFF** so it becomes **ON**.
6. Confirm no new permission prompt appears.
7. Close the popup and reload YouTube; confirm Desktop Web returns.

#### 9. Popup close/reopen persistence

1. Close and reopen MDPS once.
2. Confirm `YouTube`, **Desktop**, and Global **ON** remain.

#### 10. Extension reload recovery

1. Return to `chrome://extensions`.
2. On the MDPS card, click **Reload**.
3. Return to the existing YouTube tab and open MDPS.
4. Confirm the Site, **Desktop**, and Global **ON** remain.
5. Close the popup and reload YouTube; confirm Desktop Web returns without another permission prompt.

#### 11. External permission revoke and regrant

1. Open `chrome://extensions`.
2. On the MDPS card, click **Details**.
3. Under **Permissions** / **Site access**, find the allowed YouTube site entries.
4. Use the entry's menu and click **Remove** for `www.youtube.com` (remove both YouTube entries if Chrome groups or requires it).
5. Return to the YouTube tab and open MDPS.
6. Confirm the saved `YouTube` Site and **Desktop** selection remain, while **Site access required.** and **Grant access** appear.
7. Close the popup and reload once; confirm the Desktop override is stopped for the revoked current host.
8. Open MDPS and click **Grant access**.
9. Approve the exact-host prompt.
10. Confirm the warning disappears; close the popup and reload YouTube; confirm Desktop Web returns.

Chrome labels can vary. The supported alternate route is Extensions menu → MDPS menu → **This can read and change site data**, then remove/disable the current-site grant. Do not select an all-sites grant.

#### 12. Edit display and deletion

1. Open MDPS and click **Edit site**.
2. Confirm Name `YouTube`, both hosts, and Desktop are displayed. Do not make an unnecessary edit.
3. Click **Remove site**.
4. In the inline confirmation, click **Remove**.
5. Confirm Current Site becomes unregistered and **Add this site** appears.
6. Reload YouTube and confirm no MDPS override remains.
7. If Chrome's MDPS Details page plainly lists allowed sites, confirm the YouTube entries are gone. Otherwise mark only this permission-release UI check `SKIP (Chrome UI not exposed)`; automated post-remove `contains()` contracts are the evidence.

The acceptance Site is now cleaned up. The extension may remain loaded.

## 日本語

### 目的と報告方法

Desktop Chrome Stableでunpacked製品Extensionを1回だけ通しで確認する。preflightがstatic、permission model、Profile Set、DNR shapeを保証し、このsessionではbrowser UI、permission prompt、YouTube実動作、main document UA 3点、永続化、外部revokeだけを人が確認する。調査probeをloadせず、Cookie削除、logout、UA-CH/subresource/JavaScript identityの再調査を行わない。

必須項目がすべて成功した場合、報告は`PC Acceptance: PASS`だけでよい。最初の失敗で停止し、`Failed step:`と`Observed:`だけを報告する。`SKIP`はLive Chat対象がない場合と、Chrome UIからpermission releaseを容易に確認できない場合だけ許可する。

### Browser開始前

1. repository rootでPowerShellを開く。
2. `npm.cmd run verify`を実行し、`VERIFY PASS`を確認する。
3. `npm.cmd run acceptance:preflight`を実行し、`ACCEPTANCE PREFLIGHT PASS 15/15`を確認する。
4. `git status --short`を実行し、出力がないことを確認する。

失敗またはdirtyなら停止する。

### 1回のPC Acceptance Session

1. `chrome://extensions`を開き、Developer modeをON、**Load unpacked**でrepository rootを選び、errorなしを確認してMDPSをpinする。
2. `https://www.youtube.com/`を開きMDPSをクリックする。popupが安定し、横scroll/size振動がなく、Current site=`www.youtube.com`、Global ON、Add this siteを確認する。
3. **Add this site**を押し、Name=`YouTube`、hosts=`www.youtube.com`と`m.youtube.com`、Profile=`Desktop`にしてSaveする。全siteではなく明示2hostのpromptであることを確認してAllowし、Desktop selectedを確認する。
4. popupを閉じてYouTubeをreload/fresh navigationし、Desktop Web、PC viewport維持、login、動画再生、old-browser warningなしを確認する。利用可能なLive pageならchat/inputも確認し、なければLive ChatだけSKIPする。
5. F12→Network→Doc→reload→main document→Request HeadersでDesktop Chrome 152 UAが上記英語手順の値と一致することだけを確認する。
6. MDPSでMobileを選択しreloadする。Mobile Web、PC viewport維持、login、動画再生、warningなしを確認する。main document UAを上記Mobile Chrome 152値と1回だけ照合する。YouTubeによる`m.youtube.com`移行は正常である。
7. MDPSでDefaultを選びreloadする。Chrome本来の表示とnative UAへ戻り、2つのMDPS fixtureではないことだけを確認する。ここでDevToolsを閉じる。
8. Desktopへ切替えてDesktop Webを確認後、Global OFFにする。Desktop選択表示が残りProfile selectがdisabled、reloadでoverride停止を確認する。Global ONへ戻し、promptなしでreload後Desktop Webへ戻ることを確認する。
9. popupを閉じて再度開き、YouTube Site、Desktop、Global ONが保持されることを確認する。
10. `chrome://extensions`のMDPS cardでReloadし、YouTubeへ戻る。Site/Profile/Global状態が保持され、reloadでDesktop Web、追加promptなしを確認する。
11. `chrome://extensions`→MDPS **Details**→Permissions/Site access→許可済みYouTube entryのmenu→`www.youtube.com`をRemoveする（Chromeがまとめる場合は両方）。YouTubeでpopupを開き、Site/Desktopは残り、`Site access required.`と`Grant access`が出ること、reloadでoverride停止を確認する。Grant accessを押してexact-host promptを許可し、warning消失とDesktop復帰を確認する。表示名が異なる場合はExtensions menu→MDPS menu→**This can read and change site data**からcurrent-site grantを外してよい。all-sites grantは選ばない。
12. popupのEdit siteでName、2hosts、Desktop表示を確認する。Remove site→inline Removeで削除し、Current Siteが未登録、reloadでoverrideなしを確認する。Chrome Detailsでallowed sites削除を容易に確認できれば確認し、表示されなければpermission release UI確認だけSKIPする。

完了後、成功なら次だけ返す。

```text
PC Acceptance: PASS
```
