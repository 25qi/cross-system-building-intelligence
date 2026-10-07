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

要閱讀／修改 PRD 內容時，請直接處理該字串（可先用 `JSON.parse` 解出再編輯）。
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
