// 狀態與持久化。save() 不直接呼叫畫面函式 —— 由 app.js 以 onSaved() 註冊，
// 避免 state 反過來依賴 UI 而形成循環 import。
import { buildingModel } from './building-model.js';

const STORE_KEY = 'csbi-demo-v21';

const initialState = () => ({
  observations: [],
  events: [],
  incidents: [],
  analyses: [],
  actions: [],
  deviceStates: { IRR01: 'RUNNING', DP01: 'STANDBY', AHU03: 'RUNNING' },
});

let state = load();
let currentRun = { raw: [], obs: [], events: [], incident: null, tools: [], analysis: null, action: null };

const setState = (value) => {
  state = value;
};
const setCurrentRun = (value) => {
  currentRun = value;
};

// localStorage 在 file:// 與 data: URL 下會丟 SecurityError。Demo 需要能直接雙擊開啟，
// 因此偵測不到可用的 localStorage 時降級為記憶體儲存：流程照跑，只是關掉頁面後不保留。
const storage = (() => {
  try {
    const probe = STORE_KEY + '--probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return {
      persistent: true,
      read: () => localStorage.getItem(STORE_KEY),
      write: (value) => localStorage.setItem(STORE_KEY, value),
    };
  } catch {
    let memory = null;
    return {
      persistent: false,
      read: () => memory,
      write: (value) => {
        memory = value;
      },
    };
  }
})();

function load() {
  try {
    return JSON.parse(storage.read()) || initialState();
  } catch {
    return initialState();
  }
}

let savedHandlers = [];
const onSaved = (fn) => savedHandlers.push(fn);

function save() {
  try {
    storage.write(JSON.stringify(state));
  } catch (error) {
    // 配額用盡等寫入失敗不應中斷流程；保存是輔助，不是 demo 的必要條件。
    console.warn('狀態保存失敗，流程繼續以記憶體狀態執行。', error);
  }
  savedHandlers.forEach((fn) => fn());
}

const stateOf = (id) =>
  state.deviceStates[id] || buildingModel.devices.find((d) => d.id === id)?.state || 'UNKNOWN';

// 同時必須撤掉上一輪 Action Service 寫回的 Observation（OBS-036），
// 否則會出現「目前狀態 RUNNING、近期事實 STOPPED」這種自相矛盾的脈絡。
function resetScenarioState() {
  buildingModel.devices.forEach((device) => {
    state.deviceStates[device.id] = device.state;
  });
  state.observations = state.observations.filter((o) => o.raw_payload?.source !== 'action_service');
}

export {
  STORE_KEY, state, currentRun, setState, setCurrentRun,
  storage, load, save, onSaved, initialState, stateOf, resetScenarioState,
};
