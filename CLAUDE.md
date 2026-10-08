# CLAUDE.md

本檔提供 Claude Code 在此 repo 工作時的指引。

## 專案概述

**Cross-System Building Intelligence（跨系統建築智慧整合）** — 面試 follow-up 用的
concept prototype，示範智慧建築／智慧社區中「多個獨立子系統的分散訊號，如何被整合成
同一個 Incident，再結合 Building Context 讓 AI 產生可追溯、可人工審核的決策建議」。

所有 telemetry、threshold、device ID 與 scenario data 皆為 **synthetic data**，
不代表任何公司的實際 production architecture。

## 檔案結構

拆分為 ES modules，**無建置流程、無相依套件、無後端**，可直接由靜態主機提供。

```
index.html   prd.html   styles/{base,dashboard,responsive}.css
src/app.js  dom.js  building-model.js  scenarios.js  state.js
src/pipeline/{adapters,normalize,events,correlate,agent,actions}.js
src/ui/{pulse,scene,flow,render,scenario-picker}.js
```

**依賴是單向的。** `app.js` 是唯一同時認識 pipeline 與 UI 的模組；
其餘跨層互動一律以回呼註冊，避免循環 import：

| 回呼 | 註冊者 | 用途 |
|---|---|---|
| `onSaved()` | state.js | `save()` 後重畫，state 不需 import UI |
| `setReviewHandlers()` | ui/render.js | 核准／拒絕的處理函式由 app.js 注入 |
| `setOnExecuted()` | pipeline/actions.js | 執行完成後觸發重畫 |
| `setOnCleared()` | ui/scenario-picker.js | 選回 `---` 時呼叫 `resetRun()` |
| `setRenderDecision()` / `setRenderCurrent()` | ui/flow.js | `setStep()` 需要重畫但不應依賴 render |

跨模組的可變狀態用 getter／setter 匯出（`currentRun` / `setCurrentRun`、
`getRunToken` / `bumpRunToken`、`isBusy`、`getLastCorrelation`、
`selectedTwinDevice` / `setSelectedTwinDevice`），不要直接匯出會被重新賦值的 `let`。

### PRD 已是獨立檔案

`prd.html` 是完整的獨立文件，用一般 `<a href="prd.html">` 連結。
**不要再把它變回 JS 字串。** 先前以 `prdPageHtml` escaped string 內嵌，
改一個字都要處理跳脫，是這個專案最大的維護痛點。

PRD 頁面自己有一套響應式版面：桌面版（無 media query）的 `.doc-layout` 是
`180px minmax(0,1fr)`；側邊目錄是可收合的 `<details class="toc-fold" open>`，
收起時 `:has()` 會把側欄改為 `auto` 讓內文變寬。
≤800px 與 ≤450px 另有堆疊版本，改寬度時注意不要動錯那一條。
PRD 共 16 章，第 15 節含 Building Metadata Quality 風險。

### 修改 CSS 時的陷阱

三個 CSS 檔是按**順序串接**的（base → dashboard → responsive），
切分點必須落在規則之間。曾經切在 `:root { }` 中間 —— 三檔接回來 byte-identical，
但各自都是無效 CSS，整個儀表板版面會崩掉。改動後逐檔確認大括號平衡。

## 執行方式

**必須透過 HTTP 提供服務。** 拆成 ES modules 後，`file://` 會被 CORS 擋住模組載入，
雙擊開啟不再可行（這是「不維持一頁式」的必然代價）。

`storage` 的記憶體 fallback 仍然保留 —— localStorage 在隱私模式或封鎖站台資料時
同樣會丟 SecurityError，此時降級為記憶體保存並在右上角顯示提示。

```bash
python3 -m http.server 4178
```

然後開啟 <http://localhost:4178/>。線上版：https://25qi.github.io/cross-system-building-intelligence/
（`.claude/launch.json` 已設定好同一組指令，可用 preview_start 的 `demo` 設定啟動。）

版面是 `height:100dvh; overflow:hidden` 的固定視窗儀表板，為桌面寬版設計。
≤1000px 時 2.5D 場景的設備標籤會自動收合為只顯示設備代碼（數值改由上方 HUD 與
左側設備脈絡面板呈現），避免標籤互相重疊。驗證完整版面請用 ≥1400px 寬度。

## 版面結構

固定視窗儀表板（`height:100dvh; overflow:hidden`），三欄絕對定位：

| 欄位 | 內容 | 角色 |
|---|---|---|
| 上方 HUD `.world-readings` | 三個觀測讀數 + 情境選擇 | 四格同一列；讀數是輸入值故壓小，情境選擇是操作點 |
| 左 `.context-left` | 設備脈絡 Context Inspector ＋ 底部本次觀測事實 | 皆為設備視角：上方是選取設備的狀態／能力／關係，下方是本次各設備量到什麼 |
| 中 `.twin-scene` | 2.5D 場景 | Building Context 的空間呈現 |
| 右 `.context-right` | **Incident Processing** 單一區塊 | 九個流程步驟、Incident 判定、AI 分析與人工審核全在一塊 |

### 右欄：Incident Processing

右欄是**單一區塊**，標題 `Incident Processing`，由上而下就是整條處理流程：

```
Incident Processing
[1 Telemetry › 2 Normalize › 3 Event › 4 Incident]
[5 AI tools/query › 6 Analysis › 7 Human Review › 8 Action › 9 New Observation]
AI 分析摘要 → 可執行依據 → 拒絕／核准操作 → 執行結果 → 回饋 Observation

Incident 的判定結果（含「未建立」與原因）只在步驟 4 的資料卡裡，
不另外常駐一塊。曾有一個常駐的 #incidentSummary 與步驟 4 卡片講同一件事，已移除。
```

**點選流程節點，該階段的資料就顯示在節點正下方**（`#overview .stage-data`），
再點一次收合；不另開面板。資料卡共七張：步驟 1–6 加上步驟 7（人工審核依據，
`#decisionRecommendation`）。只有步驟 8、9 沒有資料卡，它們的結果就是下方的
`#executionBox` 與 `#feedbackBox`（見 `reviewStages`）。

`setStep()` 在流程推進時會同步 `selectedFlowStage`，否則下一次點同一個節點
會被當成「再按一次收合」。

`#incidentSummary` **只在未建立 Incident 時才有內容**。已建立時流程步驟 4
已經標示，下方 AI 分析也會描述它，再列一張判定卡只是重複；反例情境的
「為什麼不建立」才是這個 demo 要證明的事，所以保留。

原始觀測值在左欄「本次觀測事實」。事實與推論的區分現在是左欄與右欄之分，
不再靠色條。

### 人工審核的三條路徑

核准與拒絕都會走到步驟 8 Action — Action 階段一定有結論，差別只在結論是什麼。
只有「設備狀態真的改變」才會進到步驟 9。

| 路徑 | 到達步驟 | `execution_status` | 設備 |
|---|---|---|---|
| 核准 STOP（情境 A） | 9 | `SUCCESS` | IRR01 → STOPPED，產生 OBS-036 |
| 核准 INSPECT（情境 B） | 8 | `NOT_EXECUTED_IN_MVP` | 不變 |
| 拒絕 | 8 | `NOT_EXECUTED_REJECTED` | 不變 |

拒絕不產生新 Observation：Observation 是設備量到的事實，人工決策不是。
處置結果寫在 Action 紀錄裡（`state.actions`、稽核鏈與保存紀錄都看得到）。

### 空間約束（改版容易踩到）

- **橫向流程鏈的五個步驟約需 370px 才不截斷文字。** `--right` 在 ≤1200px 設 375px
  就是為了這個；≤950px 撐不住，才退回兩欄並移除會指向錯誤方向的 › 連接符號。
  改動 `--right` 或步驟字級後，請用 `scrollWidth > clientWidth` 檢查是否截斷。
- `#actionBox` 在 `PROPOSED` 期間透過 `.decision-panel.awaiting-review` 變成
  `position: sticky`，確保核准／拒絕永遠在可視範圍內。核准後 class 移除，
  才不會蓋住 `#executionBox` 與 `#feedbackBox`。
- `.incident-context` 設 `max-height: 34%`；內含流程列與 Incident 判定結果。
- **左欄兩塊共用高度，不可讓其中一塊用 `flex: 1`。** `flex: 1` 等同
  `flex-basis: 0`，那一塊只能拿「剩下的」空間；另一塊用自然高度就會把它擠到看不見
  （短視窗時設備脈絡曾被壓到只剩 190px，近期事實與 Relationships 全被切掉）。
  現為 `.inspector-panel { flex: 1 1 auto; min-height: 90px }` 搭配
  `.observation-list { flex: 0 1 auto; max-height: 45% }`，兩塊各自捲動。

### 情境選擇的互動流程

選單、說明與執行鈕共用 `.world-scenario` 這一個方框，是同一塊而非兩塊
（說明曾是浮在格子外的下拉浮層，已改為內嵌）：

```
--- （預設）   說明收合、沒有執行鈕、整格持續呼吸提示
   ↓ 選擇情境
展開說明        情境背景與展示目標，執行鈕在說明最下方
   ↓ 執行
收合            把畫面讓給流程結果
   ↓ 選回 ---
完全重置        resetRun()：畫面回到剛開啟網頁的狀態
```

- 執行鈕是 `renderScenarioBrief()` 產生的，會隨 innerHTML 置換而重建，
  因此以 `#scenarioBrief` 的事件委派綁定，不可直接 `addEventListener` 在按鈕上。
  `setBusy()` 也必須判斷按鈕是否存在（`---` 狀態下它不存在）。
- `runScenario()` 以 `!key` 擋掉未選情境的執行。

### 呼吸燈

有兩種，用途不同：

- **提示用（持續）**：`.world-scenario.awaiting-pick`，CSS 的
  `scenario-breathe` 無限循環，只在尚未選擇情境時出現，指出操作起點。
- **狀態改變用（一次性）**：`state-pulse`，**只在「核准並實際執行操作後」出現一次**，
  標示真正改變的設備與新增的紀錄。
執行情境、點選場景設備、點選流程步驟都不觸發 — 動畫是用來指出狀態改變，
不是用來回應每一次點擊。

`pulseNodes()` 全域只維持一組，開新的一組會先 `stopPulse()` 停掉前一組。
`deviceNodes()` 只回傳節點清單而不自己點亮，因為呼叫端通常要再加上其他節點
組成同一組；若它自己呼叫 `pulseNodes()`，後續那次會把前一組取消掉。
移除 class 後需強制一次 reflow 動畫才會重播。

### 已移除的區塊（勿重新加回）

這些都曾存在，因為資訊重複而刻意移除：

- `AI 本次查詢快照`：State／Zone／Capabilities／近期紀錄在下方設備脈絡都有，
  而「查詢時 vs 目前」的對照右欄「可執行依據」已經在做。
- `#twinUsageBadge`：與場景上的 `#contextLiveBanner` 是同一個數字。
- `.review-label`「Human Review → Action → New Observation」：就是流程步驟 7–9。
- 九個 `.flow-description`：全部 `display:none` 的死 UI。
- `.decision-inputs`、`#decisionContext` 收合清單、`.scene-bottom` 圖例。
- `#flowStatus` 仍存在但以 sr-only 隱藏 — 它是這個流程唯一的 `aria-live` 區域，
  刪掉會讓螢幕閱讀器收不到任何進度通知。

## Telemetry 是刻意異質的

步驟 1 的 payload **各子系統格式都不同**，這是這個 demo 的核心命題（跨系統整合）
唯一能被證明的地方。曾經所有 payload 都是同一個結構，`normalize()` 實際上沒有在
統一任何東西，PRD 卻宣稱「將不同格式資料轉成統一 schema」—— 宣稱與實作對不上。

目前七種來源各有自己的欄位名稱、時間表示法與數值包法：

| `source` | 識別欄位 | 時間 | 數值 |
|---|---|---|---|
| `WEATHER_STATION` | `msg_id` | epoch 毫秒 | 指標名稱內含單位（`rainfall_mm_per_h`） |
| `LAKE_SENSOR` | `seq` | UTC ISO | 巢狀 `reading{quantity,value,uom}` |
| `IRRIGATION_CTRL` | `event_ref` | 本地字串 `2026/10/07 15:19:10` | `state` 字串 |
| `BACNET` | `notificationId` | ISO +08:00 | `presentValue` 索引 + `stateText` 字典 |
| `BMS_POINTS` | `batchId` | 本地字串 | `points[]` 陣列 |
| `METER` | `readingId` | UTC ISO | 欄位名即單位（`kW`） |
| `OCCUPANCY_NODE` | `uplinkId` | epoch 秒 | `occupancy` 列舉 |

新增情境或子系統時，**必須同時在 `telemetryAdapters` 加對應的 adapter**，
否則 `normalize()` 會丟「未知的 telemetry 來源」。不要為了方便而讓新子系統
沿用既有格式 —— 那會把這個 demo 唯一在證明的事情再次抹平。

## 核心架構

9 階段 pipeline，對應畫面下方流程列與 `flowSteps` 陣列：

```
Telemetry → Normalize → Event → Incident → AI tools/query
          → Analysis → Human Review → Action → New Observation
```

分層原則（這是本專案的設計主張，修改時務必維持）：

- **Observation 是 source of truth**。AI 只新增 inference，不覆寫原始事實。
- **Event 由 deterministic rule 產生**，AI 不參與 `detectEvents()`。
- **AI 不直接操作設備**。任何控制指令都必須經 `approveAction()` 的 human approval。
- **操作後的新設備狀態回到 Observation pipeline**（OBS-036），形成可稽核閉環。

### 關鍵資料結構

| 名稱 | 說明 |
|---|---|
| `buildingModel` | Structured Digital Twin：`zones` / `devices` / `relationships`。device 帶 `capabilities` 與預設 `state` |
| `scenarios` | 4 組情境的原生 telemetry payload：`lake` / `hvac` / `rainOnly` / `legitHvac`。**每個子系統用自己的格式**，不可預先統一 |
| `telemetryAdapters` | 每個 telemetry 來源一個 adapter，把原生欄位對映為統一的 Observation 欄位 |
| `scenarioBriefs` | 各情境的背景敘述與展示目標文案 |
| `state` | 持久化狀態：`observations` / `events` / `incidents` / `analyses` / `actions` / `deviceStates`，存於 localStorage |
| `currentRun` | 本次執行的暫態：`raw` / `obs` / `events` / `incident` / `tools` / `analysis` / `action` / `scenario` |

localStorage key：`csbi-demo-v21`。所有讀寫都經過 `storage` 抽象層
（`storage.persistent` / `read` / `write`），在儲存不可用時自動退回記憶體模式。

### 核心函式

| 函式 | 職責 |
|---|---|
| `normalize()` / `ingest()` | 以 adapter 對映原生 telemetry → 統一 Observation；`system` 與 `zone_id` 從 `buildingModel` 設備登錄查出而非由 telemetry 提供；以 adapter 取出的 `source_event_id` 去重 |
| `detectEvents()` | deterministic rule 判定，產生 Event（RULE-W01/L01/I01/H01/E01） |
| `correlate()` | 跨系統關聯，決定是否建立 Incident |
| `tools` | AI 可呼叫的 Building Context 查詢工具（6 支） |
| `runAgent()` | 模擬 AI：呼叫 tools、記錄 tool log、產出 structured analysis |
| `approveAction()` / `rejectAction()` | human review 分支 |
| `executeApprovedAction()` | 執行控制並回寫新 Observation |
| `querySnapshot()` | 取出「AI 當時查詢到的狀態」，與目前狀態分開呈現 |
| `resetScenarioState()` | 每次執行前把設備狀態還原為 buildingModel 初始值，並撤掉上一輪 Action Service 寫回的 Observation |
| `storage` | localStorage 可用性探測與記憶體 fallback |
| `selectScenario()` | 同步選取值、tooltip、背景說明、說明展開狀態與提示呼吸 |
| `pulseNodes()` / `stopPulse()` | 呼吸燈，全域單一組 |

### Event rules

每條規則都帶 `text`（如 `rainfall > 30 mm/h`），會顯示在觀測事實與 Event 卡片上。
門檻原本只存在於程式碼，畫面只看得到 `RULE-W01` 這個代號，無從判斷為何成立；
新增或修改規則時 `text` 要一起更新，否則畫面會少掉判定依據。

| Rule | 條件 | Event |
|---|---|---|
| RULE-W01 | weather.rainfall > 30 | HEAVY_RAINFALL |
| RULE-L01 | lake.water_level > 80 | HIGH_WATER_LEVEL |
| RULE-I01 | irrigation.status == RUNNING | IRRIGATION_ACTIVE |
| RULE-H01 | hvac.power > 85 | HVAC_HIGH_CONSUMPTION |
| RULE-E01 | energy.power > 170 | BUILDING_ENERGY_HIGH |

### Incident 關聯條件

`correlate()` 以 `correlationRules` 驅動，**三個條件都要成立**才建立 Incident
（PRD Step 4 的 Temporal / Spatial / Semantic）：

| 條件 | 怎麼判 |
|---|---|
| 語意 | **從 `buildingModel.relationships` 推導**：哪些 Event 的來源設備指向規則關注的對象（`rule.feature`），其中 `severity === 'warning'` 的要有 `MIN_RISK_EVENTS`（2）個 |
| 時間 | 這些 Event 的 `started_at` 跨距是否在 `CORRELATION_WINDOW_MIN`（15 分鐘）內 |
| 空間 | `zone_id` 是否同區或有上下層關係（`zonesRelated()` 走 zones 的 parent 鏈） |

`CORR-02` 另有第四層「脈絡」：高負載若能被室外溫度與人流合理解釋就不報。

**規則不列舉 Event 類型。** 它只宣告「關注哪個對象」與「這個對象出事時叫什麼」；
哪些 Event 算相關是查關係圖得到的（`eventPointsAt()` → `deviceTargets()`）。
新增設備時只要在 `relationships` 補上指向該對象的邊，關聯自動成立，
不需要改 `correlate()`。

因此 **`relationships` 是關聯判定的輸入，不只是 AI 查詢用的參考資料**。
每個設備都要有指向其「關注對象」的邊，漏掉就不會被納入關聯
（`IRR01 operates OUTDOOR` 與 `DP01 drains OUTDOOR` 原本漏寫，PRD 第 7 節有）。

都不成立時 `lastCorrelation` 取**最接近成立**的那條規則（先比風險 Event 數，
再比通過的條件數），否則會報到不相干的規則上。步驟 4 的資料卡逐條顯示 ✓／✗。


## 四個情境的預期結果

| 情境 | 輸入 | 預期行為 |
|---|---|---|
| A · 湖區風險 (`lake`) | 38.2 mm/h、82 cm、IRR01 RUNNING、DP01 STANDBY | 建立 Incident → 建議 **STOP IRR01** → 核准後 RUNNING→STOPPED → 產生 OBS-036 |
| B · 用電分析 (`hvac`) | 27°C、人流 LOW、AHU03 92 kW、總表 186 kW | 建立 Incident → 建議 **INSPECT AHU03**（證據強度 MEDIUM，不宣稱故障） |
| 反例 C (`rainOnly`) | 38.2 mm/h、水位 58 cm | **不建立 Incident**，流程停在 Step 4，不啟動 AI |
| 反例 D (`legitHvac`) | 35°C、人流 HIGH、AHU03 94 kW、總表 189 kW | **不建立 Incident**，高負載由建築脈絡合理解釋 |

反例情境是刻意設計的「系統何時該保持安靜」驗證，**修改 `correlate()` 時必須重跑 C 和 D 確認仍不觸發**。

## 開發慣例

- 繁體中文 UI 文案；程式碼識別字、Event/Incident type、capability 一律英文大寫底線。
- 所有插入 DOM 的動態值都要經 `esc()` 轉義。
- ID 以 `uid(prefix)` 產生：`OBS-` / `EVT-` / `INC-` / `ANA-` / `ACT-`。
  例外：回饋 Observation 固定為 `OBS-036`（對應 PRD 文件中的範例編號）。
- 無測試框架。驗證方式為手動跑完四個情境（含核准與拒絕兩條分支）。
- 修改後請同步確認內嵌 PRD（`prdPageHtml`）敘述是否仍一致，兩者會互相對照。

## 注意事項

- **場景互動有兩個入口**：浮動的設備標籤按鈕（`.scene-device`）與 SVG 上的圖釘
  （`.scene-marker`）。SVG 整體是 `pointer-events:none`，圖釘靠 `.scene-marker`
  單獨開啟，兩者都在 `renderContext()` 綁定點擊。新增設備時兩邊都要接。
- **`OBS-036` 是寫死的 ID**，對應 PRD 文件中的範例編號，因此同時只會存在一筆回饋
  Observation。清除判定靠 `raw_payload.source === 'action_service'`，不是靠 ID。
- `.scene-device` 的寬度在 `max-height: 650px` 斷點仍為固定值（短視窗但寬螢幕時
  標籤不需收合），修改 RWD 時注意不要和 ≤1000px 的收合規則互相覆寫。
- 情境選擇是 `<select id="scenarioSelect">`，用 `<optgroup>` 分成「應建立 Incident」
  與「反例 · 應保持安靜」兩組。分組不只是排版：它讓「這個 demo 也驗證何時該保持安靜」
  這個重點在收合成下拉後仍然看得見，新增情境時請歸入正確分組。

## 流程節點的命名

節點顯示文字與內部 key 是分開的：步驟 2 顯示 `Normalize`（動作），
但 `data-step` / `data-stage` 仍是 `observation`。改顯示文字時不要連帶改 key —
`reviewStages`、`#overview [data-stage]` 與 `setStep()` 都靠它對應。
