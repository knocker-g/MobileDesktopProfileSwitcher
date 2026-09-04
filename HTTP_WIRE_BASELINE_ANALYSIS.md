# HTTP Wire Baseline Analysis / HTTP Wire Baseline解析

## 日本語

### 実測環境

Sony Xperia 1 V、Quetta Android、PC版サイトOFF、native viewport、PC Chrome `chrome://inspect/#devices`、DevTools Network、Preserve log/Disable cache ON。Quetta tabはremote targetとして実測上利用可能だった。

### Observed

initial `main_frame`でNative→Successの4headerすべてがchangedした。

| Header | Native | Success |
|---|---|---|
| `User-Agent` | `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36` | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36` |
| `Sec-CH-UA` | `"Chromium";v="148", "Quetta";v="148", "Not/A)Brand";v="99"` | `"Not/A)Brand";v="8", "Chromium";v="154", "Google Chrome";v="154"` |
| `Sec-CH-UA-Mobile` | `?1` | `?0` |
| `Sec-CH-UA-Platform` | `"Android"` | `"Windows"` |

Success same-origin JavaScript requestでも4headerはSuccess `main_frame`と一致した。既存JS ProbeではSuccess時もPage/WorkerはQuetta 148、Android、mobile=true、Xperia modelのnative identityだった。従ってObservedな成功状態はwire=Desktop Chrome/Windows、JavaScript=Quetta/Android/mobileである。

### Inferred

成功profileの主要作用はHTTP wire側にある可能性が高い。JS identity完全整合をMVP初期prototypeに入れる根拠はなく、navigator/Worker patchはProbably unnecessaryを維持する。`Sec-CH-UA-Mobile`やPlatformがDesktop選択へ寄与しそうでも、必要性はまだ因果検証されていない。

### Unknown

4headerのどれがDesktop WebまたはNative Live Chatに必要か、S1で十分かS2が必要か、redirect identity、Native same-origin header、追加high-entropy wire hint、Chrome 154というversion自体の必要性は未確定。Success same-originへの適用はObservedだが必要性ではない。

### 最小A/B設計

experiment fixtureとしてSuccessのChrome 154値を固定し、product defaultとは分離する。値軸はA=UA、B=A+Mobile、C=B+Platform、D=C+Brands。scopeはまずS1=`main_frame`のみ。A/S1から順に、初めて成功した時点で追加を止め、各headerを一つずつ外してablationする。S1全敗時だけD/S2（same-originまで）から始め、逆ablationする。全組合せ探索はしない。

成功条件: native viewport、Desktop Web、login、通常動画、Native Live Chat、基本操作。LiveFlow/NicoFlowは対象外。CAP-H実機試験では4headerすべての単独DNR変更と最終OFF復帰がPASSしたため、このQuetta実機/buildのheader変更能力gateは解消した。各headerの機能上の必要性は未確定であり、次はA〜D/S1のfunctional testを行う。

## English

### Environment

Sony Xperia 1 V, Quetta Android, Desktop Site off, native viewport, desktop Chrome `chrome://inspect/#devices`, DevTools Network, and Preserve log/Disable cache enabled. The tested Quetta tab was observable as a remote target.

### Observed

All four initial-main-frame headers changed from Native to Success. The exact values are shown in the Japanese table: Android/Chrome 148/Mobile became Windows x64/Chrome 154; Chromium/Quetta brands became Chromium/Google Chrome 154 with a different GREASE brand; `?1` became `?0`; Android became Windows. The Success same-origin JavaScript request matched all four Success main-frame values. Existing JS Probe data simultaneously retained native Quetta 148/Android/mobile/Xperia identity in Page and Worker. The observed success state is therefore wire=Desktop Chrome/Windows and JavaScript=Quetta/Android/mobile.

### Inferred

The successful profile probably acts primarily at the HTTP wire layer. There is no current basis for JS identity consistency in the initial MVP prototype, so navigator/Worker patching remains Probably unnecessary. Apparent relevance of mobile or platform hints is not causal proof.

### Unknown

It remains unknown which headers cause Desktop Web or Native Live Chat, whether S1 is sufficient, whether S2 is required, redirect and Native same-origin values, extra high-entropy wire hints, and whether Chrome 154 itself matters. Observed S2-like Success coverage is not proof of necessity.

### Minimal A/B design

Use the Chrome 154 Success values only as an experiment fixture, separate from a product default. Value axis: A=UA; B=A+Mobile; C=B+Platform; D=C+Brands. Scope axis starts with S1 main frame only. Stop at first success and ablate one header at a time. Only if all S1 runs fail, start D/S2 through same-origin requests and reverse-ablate. Do not exhaustively enumerate combinations.

Success requires native viewport, Desktop Web, login, playback, Native Live Chat, and intact basic operation. LiveFlow/NicoFlow are excluded. CAP-H device testing passed independent DNR modification of all four headers plus the final OFF restoration, resolving the header-capability gate for this Quetta device/build. Functional necessity remains unknown; A–D/S1 is next.
