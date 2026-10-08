// 步驟 8：只有核准後才進入 Action Service；執行結果回寫成新的 Observation。
import { state, currentRun, save } from '../state.js';

let onExecuted = () => {};
const setOnExecuted = (fn) => { onExecuted = fn; };

function executeApprovedAction(action) {
  action.status = 'APPROVED';
  action.approved_at = new Date().toISOString();
  if (action.target_device_id === 'IRR01' && action.action_type === 'STOP') {
    state.deviceStates.IRR01 = 'STOPPED';
    action.status = 'EXECUTED';
    action.executed_at = new Date().toISOString();
    action.execution_status = 'SUCCESS';
    const obs = {
      id: 'OBS-036',
      source_event_id: 'ACTION-' + action.id,
      device_id: 'IRR01',
      system: 'irrigation',
      zone_id: 'OUTDOOR',
      metric: 'status',
      value_numeric: null,
      value_text: 'STOPPED',
      unit: null,
      observed_at: new Date().toISOString(),
      received_at: new Date().toISOString(),
      raw_payload: { source: 'action_service', action_id: action.id, status: 'STOPPED' },
    };
    if (!state.observations.some((o) => o.id === 'OBS-036')) state.observations.push(obs);
    currentRun.obs.push(obs);
    currentRun.action = action;
  } else {
    action.status = 'APPROVED';
    action.execution_status = 'NOT_EXECUTED_IN_MVP';
    currentRun.action = action;
  }
  save();
  onExecuted();
}

export { executeApprovedAction, setOnExecuted };
