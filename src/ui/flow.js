// 九個流程節點：推進、標示、點選展開階段資料。
// 顯示文字與 data-step key 是分開的（步驟 2 顯示 Normalize，key 仍是 observation）。
import { $, $$ } from '../dom.js';
import { updateTwinUsage } from './scene.js';

let selectedFlowStage = null;
let runToken = 0;
let busy = false;
const getRunToken = () => runToken;
const bumpRunToken = () => ++runToken;
const isBusy = () => busy;

const flowSteps = [
  'telemetry',
  'observation',
  'event',
  'incident',
  'tools',
  'analysis',
  'review',
  'action',
  'loop',
];

let renderDecisionHook = () => {};
const setRenderDecision = (fn) => { renderDecisionHook = fn; };
let renderCurrentHook = () => {};
const setRenderCurrent = (fn) => { renderCurrentHook = fn; };

function setBusy(value) {
  busy = value;
  const runBtn = $('#runBtn');
  if (runBtn) {
    runBtn.disabled = value;
    runBtn.textContent = value ? '處理中…' : '執行情境';
  }
  $('#scenarioSelect').disabled = value;
  ['#approveAction', '#rejectAction'].forEach((id) => {
    const btn = $(id);
    if (btn) btn.disabled = value;
  });
}
function setStep(name, message) {
  const idx = flowSteps.indexOf(name);
  $$('.flow-node').forEach((el) => el.classList.add('visible'));
  $$('.step').forEach((el, i) => {
    el.classList.add('visible');
    el.classList.toggle('done', i < idx);
    el.classList.toggle('active', i === idx);
  });
  $$('#overview [data-stage]').forEach((el) => el.classList.toggle('revealed', el.dataset.stage === name));
  // 流程推進時也更新選取狀態，否則下一次點同一個節點會被當成「再按一次收合」。
  selectedFlowStage = name;
  if (message) {
    $('#flowStatus').textContent = message;
  }
  if (name === 'tools') updateTwinUsage(true);
  if (['analysis', 'review', 'action', 'loop'].includes(name)) updateTwinUsage(false);
  renderDecisionHook();
}
function clearSteps() {
  $$('.flow-node').forEach((el) => el.classList.remove('visible'));
  $$('.step').forEach((el) =>
    ['visible', 'done', 'active', 'selected'].forEach((c) => el.classList.remove(c)),
  );
  $$('#overview [data-stage]').forEach((el) => el.classList.remove('revealed'));
  selectedFlowStage = null;
  $('#flowStatus').textContent = '執行情境後，處理結果將一次顯示；建議操作仍需人工審核。';
  updateTwinUsage(false);
  renderDecisionHook();
}
async function showStage(name, message, token) {
  if (token !== runToken) return false;
  renderCurrentHook();
  setStep(name, message);

  return token === runToken;
}
function showOverview() {
  /* v12 is a single-page block layout */
}


// 階段資料直接顯示在流程節點正下方，不另開面板。
// 步驟 7–9 沒有獨立資料卡，它們的結果就是下方的審核與處置區塊。
const reviewStages = ['action', 'loop'];

function focusFlowStage(name) {
  const same = selectedFlowStage === name;
  selectedFlowStage = same ? null : name;
  const shown = selectedFlowStage;
  $$('.step').forEach((btn) => {
    const on = btn.dataset.step === shown;
    btn.classList.toggle('selected', on);
    btn.setAttribute('aria-expanded', String(on));
  });
  $$('#overview [data-stage]').forEach((card) =>
    card.classList.toggle(
      'revealed',
      !!shown && !reviewStages.includes(shown) && card.dataset.stage === shown,
    ),
  );
  updateTwinUsage(false);
}
$$('.step').forEach((btn) => {
  btn.setAttribute('aria-controls', 'overview');
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => focusFlowStage(btn.dataset.step));
});
document.addEventListener?.('keydown', (e) => {
  if (e.key === 'Escape' && selectedFlowStage) focusFlowStage(selectedFlowStage);
});

export { flowSteps, setBusy, setStep, clearSteps, showStage, showOverview, focusFlowStage, selectedFlowStage, getRunToken, bumpRunToken, isBusy, setRenderDecision, setRenderCurrent };
