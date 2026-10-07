# CLAUDE.md

本檔提供 Claude Code 在此 repo 工作時的指引。

## 專案概述

**Cross-System Building Intelligence（跨系統建築智慧整合）** — 面試 follow-up 用的
concept prototype，示範智慧建築／智慧社區中「多個獨立子系統的分散訊號，如何被整合成
同一個 Incident，再結合 Building Context 讓 AI 產生可追溯、可人工審核的決策建議」。

所有 telemetry、threshold、device ID 與 scenario data 皆為 **synthetic data**，
不代表任何公司的實際 production architecture。

## 檔案結構

本專案目前是**單一自包含 HTML 檔**，無建置流程、無相依套件、無後端。

```
Cross-System-Building-Intelligence-Demo-v21.html   # 全部內容（HTML + CSS + JS + 內嵌 PRD）
.claude/launch.json                                 # preview_start 用的本機靜態伺服器設定
```

檔案內部分區（行號為 v21 當下）：

| 範圍 | 內容 |
|---|---|
| 2–39 | `<style>`：全部 CSS |
| 40–129 | `<body>`：版面、2.5D SVG 場景、流程列、各面板容器 |
| 134 | `prdPageHtml` — **完整專案 PRD v02**，以 JS escaped string 內嵌 |
| 135–701 | 應用程式邏輯（單一 IIFE） |

### 內嵌 PRD

PRD 不是獨立檔案，而是 line 134 的 `prdPageHtml` 字串。執行時以
`URL.createObjectURL(new Blob([...]))` 產生 blob URL 掛到右上角「專案 PRD ↗」。

要閱讀／修改 PRD 內容時，請直接處理該字串（prettier 會把它轉成單引號，
解析時用 `eval('(' + literal + ')')` 比 `JSON.parse` 穩）。改完務必重新解出渲染確認。

PRD 頁面自己有一套響應式版面：桌面版（無 media query）的
`.doc-layout` 是 `180px minmax(0,1fr)`，側邊目錄 180px；
≤800px 與 ≤450px 另有堆疊版本，改寬度時注意不要動錯那一條。
PRD 共 16 章：Executive Summary、Background & Problem、Product Goal、Target User、
Product Concept、Core Flow、Building Context、Scenario A、Scenario B、
Negative Scenarios、AI Role & Guardrails、Persistence & Auditability、MVP Scope、
MVP Success Criteria、Risks & Assumptions、Closing Note。

## 執行方式

**直接雙擊開啟（`file://`）即可，這是寄給面試官的主要使用方式。**

瀏覽器在 `file://` 與 `data:` URL 下會停用 `localStorage`。程式啟動時會探測可用性，
偵測不到就降級為記憶體保存：四個情境與完整流程照常執行，只是重新整理後不保留先前紀錄，
並在右上角顯示「記憶體模式 · 關閉頁面後不保留紀錄」提示。

若要測試完整的 localStorage 持久化行為，需透過 http:// 提供服務：

```bash
python3 -m http.server 4178
```

然後開啟 `http://localhost:4178/Cross-System-Building-Intelligence-Demo-v21.html`。
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
[1 Telemetry › 2 Observation › 3 Event › 4 Incident]
[5 AI tools/query › 6 Analysis › 7 Human Review › 8 Action › 9 New Observation]
Incident 判定結果（未建立時說明原因）
AI 分析摘要 → 可執行依據 → 拒絕／核准操作 → 執行結果 → 回饋 Observation
```

步驟 7–9 沒有獨立資料卡，點擊它們不開資料面板，改為標示對應區塊
（見 `reviewStages`）；步驟 1–6 才開 `#flowDetails`。

原始觀測值在左欄「本次觀測事實」。事實與推論的區分現在是左欄與右欄之分，
不再靠色條。

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

## 核心架構

9 階段 pipeline，對應畫面下方流程列與 `flowSteps` 陣列：

```
Telemetry → Observation → Event → Incident → AI tools/query
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
| `scenarios` | 4 組情境的原始 telemetry payload：`lake` / `hvac` / `rainOnly` / `legitHvac` |
| `scenarioBriefs` | 各情境的背景敘述與展示目標文案 |
| `state` | 持久化狀態：`observations` / `events` / `incidents` / `analyses` / `actions` / `deviceStates`，存於 localStorage |
| `currentRun` | 本次執行的暫態：`raw` / `obs` / `events` / `incident` / `tools` / `analysis` / `action` / `scenario` |

localStorage key：`csbi-demo-v21`。所有讀寫都經過 `storage` 抽象層
（`storage.persistent` / `read` / `write`），在儲存不可用時自動退回記憶體模式。

### 核心函式

| 函式 | 職責 |
|---|---|
| `normalize()` / `ingest()` | telemetry → 統一 Observation schema，以 `source_event_id` 去重 |
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

| Rule | 條件 | Event |
|---|---|---|
| RULE-W01 | weather.rainfall > 30 | HEAVY_RAINFALL |
| RULE-L01 | lake.water_level > 80 | HIGH_WATER_LEVEL |
| RULE-I01 | irrigation.status == RUNNING | IRRIGATION_ACTIVE |
| RULE-H01 | hvac.power > 85 | HVAC_HIGH_CONSUMPTION |
| RULE-E01 | energy.power > 170 | BUILDING_ENERGY_HIGH |

### Incident 關聯條件

- `WEATHER_RELATED_LAKE_RISK`：同時有 HEAVY_RAINFALL **且** HIGH_WATER_LEVEL
- `HVAC_ENERGY_EFFICIENCY_RISK`：同時有 HVAC_HIGH_CONSUMPTION **且** BUILDING_ENERGY_HIGH，
  **再加上** 室外溫度 ≤ 30°C 且人流 == LOW（否則視為合理負載，不建立 Incident）

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
