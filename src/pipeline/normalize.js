// 步驟 2：原生 telemetry → 統一 Observation。
import { uid } from '../dom.js';
import { buildingModel } from '../building-model.js';
import { state } from '../state.js';
import { telemetryAdapters } from './adapters.js';

function normalize(payload) {
  const adapter = telemetryAdapters[payload.source];
  if (!adapter) throw new Error('未知的 telemetry 來源：' + payload.source);
  const f = adapter(payload);
  // system 與 zone 不是 telemetry 給的，而是從 Building Context 的設備登錄查出來。
  // 子系統只知道自己送了什麼，不知道這台設備屬於哪一區。
  const device = buildingModel.devices.find((d) => d.id === f.device_id);
  return {
    id: uid('OBS'),
    source_event_id: f.source_event_id,
    device_id: f.device_id,
    system: device?.system || 'unknown',
    zone_id: device?.zone || 'unknown',
    metric: f.metric,
    value_numeric: typeof f.value === 'number' ? f.value : null,
    value_text: typeof f.value === 'number' ? null : String(f.value),
    unit: f.unit || null,
    observed_at: f.observed_at,
    received_at: new Date().toISOString(),
    raw_payload: payload,
  };
}

function ingest(payload) {
  // 原生 payload 的識別欄位各不相同，先經 adapter 取出才能比對
  const sourceId = telemetryAdapters[payload.source]?.(payload).source_event_id;
  if (state.observations.some((o) => o.source_event_id === sourceId))
    return state.observations.find((o) => o.source_event_id === sourceId);
  const obs = normalize(payload);
  state.observations.push(obs);
  return obs;
}

function latest(observations, system, metric) {
  return observations
    .filter((o) => o.system === system && o.metric === metric)
    .sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at))[0];
}

export { normalize, ingest, latest };
