// 情境選擇：--- → 選擇 → 展開說明（執行鈕在底部）→ 執行 → 收合 → 選回 --- 完全重置。
// 執行鈕隨說明重建，因此以事件委派綁定，不可直接 addEventListener 在按鈕上。
import { $ } from '../dom.js';
import { scenarioBriefs, scenarioHints } from '../scenarios.js';

let selectedScenario = '';
const getSelectedScenario = () => selectedScenario;
let onCleared = () => {};
const setOnCleared = (fn) => { onCleared = fn; };

function renderScenarioBrief(key) {
  const el = $('#scenarioBrief');
  if (!el) return;
  if (!key) {
    el.innerHTML = '<div class="body">請先選擇一個情境。</div>';
    return;
  }
  const b = scenarioBriefs[key];
  // 執行鈕是說明的結尾，不是獨立控制項；未選情境時自然就不存在。
  el.innerHTML = `<div class="title">${b.title}</div><div class="body">${b.body}</div><div class="goal">${b.goal}</div><button class="primary" type="button" id="runBtn">執行情境</button>`;
}

function selectScenario(key) {
  selectedScenario = key;
  const select = $('#scenarioSelect');
  if (select.value !== key) select.value = key;
  select.title = scenarioHints[key] || '';
  renderScenarioBrief(key);
  // 選了情境就展開說明（執行鈕在說明底部）；回到 --- 則收合並恢復提示呼吸。
  $('.scenario-details').open = !!key;
  $('#scenarioCell').classList.toggle('awaiting-pick', !key);
  if (!key) onCleared();
}

export { renderScenarioBrief, selectScenario, getSelectedScenario, setOnCleared };
