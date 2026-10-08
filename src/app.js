// 編排層：把 pipeline 與 UI 接起來，並註冊各模組之間的回呼。
// 這裡是唯一同時認識兩邊的地方，其餘模組維持單向依賴。
import { $, $$ } from './dom.js';
import { state, currentRun, setCurrentRun, save, onSaved, storage, resetScenarioState } from './state.js';
import { scenarios } from './scenarios.js';
import { ingest } from './pipeline/normalize.js';
import { detectEvents } from './pipeline/events.js';
import { correlate } from './pipeline/correlate.js';
import { runAgent } from './pipeline/agent.js';
import { executeApprovedAction, setOnExecuted } from './pipeline/actions.js';
import { uid } from './dom.js';
import { pulseNodes } from './ui/pulse.js';
import { deviceNodes, renderContext, setSelectedTwinDevice, fitScene } from './ui/scene.js';
import { setBusy, setStep, clearSteps, showStage, showOverview, getRunToken, bumpRunToken, isBusy, setRenderDecision, setRenderCurrent } from './ui/flow.js';
import { renderCurrent, renderDecision, renderStore, setReviewHandlers } from './ui/render.js';
import { selectScenario, getSelectedScenario, setOnCleared } from './ui/scenario-picker.js';

// 跨模組回呼：避免 state / pipeline / ui 反向 import app。
setRenderDecision(renderDecision);
setRenderCurrent(renderCurrent);
setReviewHandlers((a) => approveAction(a), (a) => rejectAction(a));
setOnExecuted(renderCurrent);
setOnCleared(() => resetRun());
onSaved(() => {
  renderStore();
  renderContext();
});

async function approveAction(action) {
  if (isBusy() || action.status !== 'PROPOSED') return;
  const token = getRunToken();
  setBusy(true);
  showOverview();
  $('#approveAction').disabled = true;
  $('#rejectAction').disabled = true;
  if (!(await showStage('action', '步驟 8：已核准，正在處理操作…', token))) return;
  executeApprovedAction(action);
  if (action.status === 'EXECUTED') {
    await showStage('loop', '步驟 9：新增 OBS-036，設備狀態已回到資料流程。', token);
  } else {
    setStep('action', '檢查建議已核准，待管理者安排設備檢查。');
  }
  if (token === getRunToken()) {
    setBusy(false);
    // 呼吸燈只用在這裡：核准並實際執行後，標示真正改變的設備與新增的紀錄。
    if (action.status === 'EXECUTED') {
      pulseNodes([...deviceNodes([action.target_device_id]), $('#executionBox'), $('#feedbackBox')]);
    }
  }
}
function rejectAction(action) {
  if (isBusy() || action.status !== 'PROPOSED') return;
  action.status = 'REJECTED';
  action.rejected_at = new Date().toISOString();
  // Action 階段仍然有結論，只是結論是「不執行」。把它寫進紀錄並走到步驟 8，
  // 否則流程看起來像停在審核中，也看不出「拒絕」是一個被保存的處置結果。
  action.execution_status = 'NOT_EXECUTED_REJECTED';
  save();
  renderCurrent();
  setStep('action', '操作已拒絕；Action 未執行，設備狀態維持原樣。');
}

async function runScenario(key) {
  if (isBusy() || !key) return;
  const token = bumpRunToken();
  setBusy(true);
  showOverview();
  setCurrentRun({
    raw: [],
    obs: [],
    events: [],
    incident: null,
    tools: [],
    analysis: null,
    action: null,
    scenario: key,
  });
  clearSteps();
  resetScenarioState();
  // 執行後收合說明與執行鈕，把畫面讓給流程結果。
  $('.scenario-details').open = false;
  try {
    const sc = scenarios[key];
    currentRun.raw = sc.payloads;
    if (!(await showStage('telemetry', '步驟 1：接收各子系統的原始遙測資料。', token))) return;
    const obsBatch = sc.payloads.map(ingest);
    currentRun.obs = obsBatch;
    save();
    if (!(await showStage('observation', '步驟 2：正規化資料，保存 Observation。', token))) return;
    const eventBatch = detectEvents(obsBatch);
    currentRun.events = eventBatch;
    save();
    if (!(await showStage('event', '步驟 3：依門檻與規則判定 Event。', token))) return;
    const inc = correlate(obsBatch, eventBatch);
    currentRun.incident = inc;
    save();
    if (
      !(await showStage(
        'incident',
        inc ? '步驟 4：相關 Event 已整合為 Incident。' : '未符合關聯條件；流程在此結束，不啟動 AI 分析。',
        token,
      ))
    )
      return;
    if (!inc) return;
    const agent = runAgent(inc);
    currentRun.tools = agent.log;
    if (
      !(await showStage(
        'tools',
        '步驟 5：AI 依 Incident 查詢 Structured Digital Twin 的設備、能力、狀態與近期紀錄。',
        token,
      ))
    )
      return;
    currentRun.analysis = agent.analysis;
    save();
    if (!(await showStage('analysis', '步驟 6：整理證據，產生結構化 AI 分析。', token))) return;
    const rec = agent.analysis?.recommended_actions?.[0];
    if (rec) {
      const action = {
        id: uid('ACT'),
        analysis_id: agent.analysis.id,
        incident_id: inc.id,
        target_device_id: rec.target_device_id,
        action_type: rec.action_type,
        reason: rec.reason,
        status: 'PROPOSED',
        created_at: new Date().toISOString(),
      };
      state.actions.push(action);
      currentRun.action = action;
      save();
      renderCurrent();
      setStep('review', '步驟 7：等待人工審核，請核准或拒絕建議操作。');
    }
  } catch (error) {
    if (token === getRunToken()) $('#flowStatus').textContent = '處理未完成，請再執行情境。';
    console.error(error);
  } finally {
    if (token === getRunToken()) setBusy(false);
  }
}

// 回到 --- 等於重新開始：清掉上一次的結果，畫面回到剛開啟網頁的樣子。
function resetRun() {
  bumpRunToken(); // 作廢任何仍在進行的流程
  setBusy(false);
  setCurrentRun({
    raw: [],
    obs: [],
    events: [],
    incident: null,
    tools: [],
    analysis: null,
    action: null,
    scenario: null,
  });
  setSelectedTwinDevice('IRR01');
  resetScenarioState();
  clearSteps();
  save();
  renderCurrent();
}

$('#scenarioSelect').addEventListener('change', (e) => selectScenario(e.target.value));
// 執行鈕隨說明重新產生，用事件委派綁定才不會因為 innerHTML 置換而失效。
$('#scenarioBrief').addEventListener('click', (e) => {
  if (e.target.id === 'runBtn') runScenario(getSelectedScenario());
});

if (!storage.persistent) {
  const notice = $('#storageNotice');
  notice.textContent = '記憶體模式 · 關閉頁面後不保留紀錄';
  notice.title =
    '瀏覽器在 file:// 下停用 localStorage，因此改用記憶體保存。四個情境與完整流程都能正常執行，只是重新整理後不會保留先前紀錄。';
  notice.hidden = false;
}

renderCurrent();
renderContext();
renderStore();
selectScenario('');
fitScene();
