# Cross-System Building Intelligence

智慧建築／智慧社區的 **concept prototype**：示範多個獨立子系統的分散訊號，
如何被整合成同一個 Incident，再結合 Building Context 讓 AI 產生可追溯、
可人工審核的決策建議。

**線上展示：** https://25qi.github.io/cross-system-building-intelligence/
**概念設計與原型說明：** [design.html](design.html)

> 所有 telemetry、threshold、device ID 與 scenario data 皆為 **synthetic data**，
> 不代表任何公司的實際 production architecture。

## 這個 prototype 在證明什麼

```
Telemetry → Normalize → Event → Incident → AI tools/query
          → Analysis → Human Review → Action → New Observation
```

四條不可跨越的邊界：

- **Observation 是 source of truth** — AI 只新增 inference，不覆寫原始事實
- **Event 由 deterministic rule 產生** — AI 不參與判定
- **AI 不直接操作設備** — 任何控制指令都要過人工核准
- **操作結果回到 Observation pipeline** — 形成可稽核閉環

四個情境中有**兩個反例**，用來驗證「系統何時該保持安靜」—— 這和「何時該報警」
同樣重要。

## 本機執行

ES modules 需要透過 HTTP 提供服務，不能直接以 `file://` 開啟：

```bash
python3 -m http.server 4178
```

然後開啟 <http://localhost:4178/>。

## 檔案結構

```
index.html              主畫面標記
design.html             概念設計與原型說明（獨立文件，不再內嵌於 JS）
styles/
  base.css              基礎樣式
  dashboard.css         固定視窗儀表板版面
  responsive.css        所有 @media 斷點
src/
  app.js                編排層：接起 pipeline 與 UI，註冊跨模組回呼
  dom.js                $ / $$ / esc / uid
  building-model.js     Structured Digital Twin（zones / devices / relationships）
  scenarios.js          四組情境的原生 telemetry payload 與文案
  state.js              狀態、localStorage 抽象層與記憶體 fallback
  pipeline/
    adapters.js         每個 telemetry 來源一個 adapter
    normalize.js        原生 payload → 統一 Observation
    events.js           deterministic rule 判定
    correlate.js        跨系統關聯（語意由關係圖推導）
    agent.js            AI tools 與 analysis
    actions.js          Action Service 與回寫 Observation
  ui/
    pulse.js            呼吸燈
    scene.js            2.5D 場景、設備脈絡、HUD
    flow.js             九個流程節點
    render.js           各階段資料卡與審核區塊
    scenario-picker.js  情境選擇
```

模組依賴是單向的；`app.js` 是唯一同時認識 pipeline 與 UI 的地方，
其餘跨層互動一律以回呼註冊（`onSaved` / `setReviewHandlers` / `setOnCleared` 等），
避免循環 import。

開發細節與各項設計決策見 [CLAUDE.md](CLAUDE.md)。
