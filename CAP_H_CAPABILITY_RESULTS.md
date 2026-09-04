# CAP-H Capability Results / CAP-H能力試験結果

## 日本語

### 実測環境

Sony Xperia 1 V、Quetta Android、PC版サイトOFF、User-Agent Switcher and Manager OFF、Android native viewportで実施した。CAP-H probeをunpacked extensionとして読み込み、`adb reverse tcp:8000 tcp:8000`経由で`http://localhost:8000/`へ接続した。PC ChromeからQuetta tabをremote inspectし、DevTools Networkで`main_frame`の実Request Headersを観測した。

### Observed

Control/OFFでは次のNative値を観測した。

| Header | Native value |
|---|---|
| `User-Agent` | `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36` |
| `Sec-CH-UA` | `"Chromium";v="148", "Quetta";v="148", "Not/A)Brand";v="99"` |
| `Sec-CH-UA-Mobile` | `?1` |
| `Sec-CH-UA-Platform` | `"Android"` |

各modeのruleは受理され、runtime errorはなく、対象headerだけがexperiment fixtureへ変化した。他の3headerは各試験でNative値を維持した。

| Test | Wire result | Other three headers | Result |
|---|---|---|---|
| CAP-H-UA | `User-Agent` = Windows 10 x64 / Chrome 154 fixture | Native値を維持 | **PASS** |
| CAP-H-CH-UA | `Sec-CH-UA` = `"Not/A)Brand";v="8", "Chromium";v="154", "Google Chrome";v="154"` | Native値を維持 | **PASS** |
| CAP-H-CH-Mobile | `Sec-CH-UA-Mobile` = `?0` | Native値を維持 | **PASS** |
| CAP-H-CH-Platform | `Sec-CH-UA-Platform` = `"Windows"` | Native値を維持 | **PASS** |
| 最終OFF復帰 | 4headerすべてNative値へ復帰 | 前modeの変更なし | **PASS** |

従って、このQuetta Android実機/buildではDNR `modifyHeaders`により4headerを個別に実wire上で変更でき、独立A/B試験が可能である。これは当該実機/buildに限定したObserved factであり、すべてのChromium Android browserに対する保証ではない。

### Inferred

「DNRでUA-CHを変更できない可能性」というCAP-H技術gateは、今回のQuetta実機/buildについて解消した。次のA/B functional testはA/S1=`User-Agent`のみ、B/S1=A+`Sec-CH-UA-Mobile`、C/S1=B+`Sec-CH-UA-Platform`、D/S1=C+`Sec-CH-UA`の順とする。最初に成功した構成ではheaderごとのablationを行い、S1が全敗した場合だけsame-origin requestまでのS2を検討する。

### Unknown

どのheaderがYouTube Desktop WebまたはNative Live Chatに必要か、`main_frame`だけで十分か、他のQuetta/Chromium buildでも同じ能力があるかは未確定である。Chrome 154はexperiment fixtureでありproduct defaultではない。JavaScript/Worker identity patchは引き続きProbably unnecessaryだが、一般に不要と証明されたものではない。

## English

### Test environment

The test used a Sony Xperia 1 V running Quetta Android with Desktop Site off, User-Agent Switcher and Manager off, and the Android native viewport. The unpacked CAP-H probe navigated to `http://localhost:8000/` through `adb reverse tcp:8000 tcp:8000`. Desktop Chrome remotely inspected the Quetta tab, and DevTools Network showed the actual `main_frame` Request Headers.

### Observed

The OFF control produced these Native values.

| Header | Native value |
|---|---|
| `User-Agent` | `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36` |
| `Sec-CH-UA` | `"Chromium";v="148", "Quetta";v="148", "Not/A)Brand";v="99"` |
| `Sec-CH-UA-Mobile` | `?1` |
| `Sec-CH-UA-Platform` | `"Android"` |

Every rule was accepted without a runtime error. Each CAP-H mode changed only its selected header to the experiment fixture while the other three retained their Native values.

| Test | Wire result | Other three headers | Result |
|---|---|---|---|
| CAP-H-UA | `User-Agent` = Windows 10 x64 / Chrome 154 fixture | Retained Native values | **PASS** |
| CAP-H-CH-UA | `Sec-CH-UA` = `"Not/A)Brand";v="8", "Chromium";v="154", "Google Chrome";v="154"` | Retained Native values | **PASS** |
| CAP-H-CH-Mobile | `Sec-CH-UA-Mobile` = `?0` | Retained Native values | **PASS** |
| CAP-H-CH-Platform | `Sec-CH-UA-Platform` = `"Windows"` | Retained Native values | **PASS** |
| Final OFF restoration | All four headers returned to Native values | No prior-mode change remained | **PASS** |

This proves independent wire modification of all four headers with DNR `modifyHeaders` on the tested Quetta Android device/build. It is an Observed fact limited to that environment, not a guarantee for all Chromium Android browsers.

### Inferred

For this Quetta device/build, the CAP-H concern that DNR might be unable to modify UA-CH is resolved. The next functional sequence is A/S1=UA only, B/S1=A+CH-Mobile, C/S1=B+CH-Platform, and D/S1=C+CH-UA. Ablate the first successful configuration one header at a time; consider S2 through same-origin requests only if every S1 test fails.

### Unknown

It remains unknown which headers are required for YouTube Desktop Web or Native Live Chat, whether `main_frame` scope is sufficient, and whether other Quetta/Chromium builds expose the same capability. Chrome 154 remains an experiment fixture, not a product default. JavaScript/Worker patching remains Probably unnecessary, not proven unnecessary in general.
