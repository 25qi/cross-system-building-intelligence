// 步驟 5–6：AI 以 tools 查詢 Building Context，產生 evidence-backed analysis。
// querySnapshot 取出「AI 當時查到的狀態」，與目前狀態分開呈現。
import { uid } from '../dom.js';
import { buildingModel } from '../building-model.js';
import { state, currentRun, stateOf } from '../state.js';

const tools = {
  get_incident_events(incident) {
    return state.events.filter((e) => incident.event_ids.includes(e.id));
  },
  get_devices_in_zone(zone) {
    return buildingModel.devices
      .filter((d) => d.zone === zone)
      .map((d) => ({
        ...d,
        state: tools.get_device_state(d.id),
        relationships: buildingModel.relationships
          .filter((r) => r[0] === d.id || r[2] === d.id)
          .map((r) => [...r]),
      }));
  },
  get_related_devices(deviceId) {
    const rel = buildingModel.relationships.filter((r) => r[0] === deviceId || r[2] === deviceId);
    const ids = new Set(
      rel.flatMap((r) => [r[0], r[2]]).filter((x) => buildingModel.devices.some((d) => d.id === x)),
    );
    return buildingModel.devices
      .filter((d) => ids.has(d.id))
      .map((d) => ({
        ...d,
        state: tools.get_device_state(d.id),
        relationships: buildingModel.relationships
          .filter((r) => r[0] === d.id || r[2] === d.id)
          .map((r) => [...r]),
      }));
  },
  get_device_capabilities(deviceId) {
    return buildingModel.devices.find((d) => d.id === deviceId)?.capabilities || [];
  },
  get_device_state(deviceId) {
    return (
      state.deviceStates[deviceId] ||
      buildingModel.devices.find((d) => d.id === deviceId)?.state ||
      'UNKNOWN'
    );
  },
  get_recent_observations(deviceId) {
    return state.observations.filter((o) => o.device_id === deviceId).slice(-8);
  },
};

function runAgent(incident) {
  const log = [];
  const call = (name, args, res) => {
    log.push({ name, args, result: res });
    return res;
  };
  const evs = call(
    'get_incident_events',
    { incident_id: incident.id },
    tools.get_incident_events(incident),
  );
  const devices = call(
    'get_devices_in_zone',
    { zone_id: incident.zone_id },
    tools.get_devices_in_zone(incident.zone_id),
  );

  if (incident.incident_type === 'WEATHER_RELATED_LAKE_RISK') {
    const irrigation = devices.find((d) => d.id === 'IRR01');
    const drain = devices.find((d) => d.id === 'DP01');
    const irrState = call('get_device_state', { device_id: 'IRR01' }, tools.get_device_state('IRR01'));
    const dpState = call('get_device_state', { device_id: 'DP01' }, tools.get_device_state('DP01'));
    const related = call('get_related_devices', { device_id: 'LS01' }, tools.get_related_devices('LS01'));
    const irrCaps = call(
      'get_device_capabilities',
      { device_id: 'IRR01' },
      tools.get_device_capabilities('IRR01'),
    );
    const irrHistory = call(
      'get_recent_observations',
      { device_id: 'IRR01' },
      tools.get_recent_observations('IRR01'),
    );
    const rainObs = currentRun.obs
      .filter((o) => o.device_id === 'W01' && o.metric === 'rainfall')
      .slice(-1)[0];
    const lakeObs = currentRun.obs
      .filter((o) => o.device_id === 'LS01' && o.metric === 'water_level')
      .slice(-1)[0];
    const irrigationObs = currentRun.obs
      .filter((o) => o.device_id === 'IRR01' && o.metric === 'status')
      .slice(-1)[0];
    const evidence = [rainObs, lakeObs, irrigationObs].filter(Boolean);
    const analysis = {
      id: uid('ANA'),
      incident_id: incident.id,
      version: 1,
      summary:
        '強降雨與目前湖面高水位在時間與區域上同時出現；灌溉系統仍為 RUNNING。建議先停止不必要的灌溉，持續監測湖面與排水設備狀態。',
      hypotheses: [
        {
          description: '強降雨可能是湖面水位升高的原因之一。',
          evidence_ids: evidence.map((x) => x.id),
          evidence_strength: 'HIGH',
        },
      ],
      recommended_actions:
        irrState === 'RUNNING' && irrCaps.includes('STOP')
          ? [
              {
                target_device_id: 'IRR01',
                action_type: 'STOP',
                reason: '強降雨期間不需要持續灌溉，且湖區灌溉設備支援停止操作。',
              },
            ]
          : [],
      model: 'building-aware-agent-v0.1',
      created_at: new Date().toISOString(),
    };
    state.analyses.push(analysis);
    incident.status = 'ANALYZED';
    return { log, analysis };
  }

  if (incident.incident_type === 'HVAC_ENERGY_EFFICIENCY_RISK') {
    const ahuRelated = call(
      'get_related_devices',
      { device_id: 'AHU03' },
      tools.get_related_devices('AHU03'),
    );
    const ahuState = call('get_device_state', { device_id: 'AHU03' }, tools.get_device_state('AHU03'));
    const ahuCaps = call(
      'get_device_capabilities',
      { device_id: 'AHU03' },
      tools.get_device_capabilities('AHU03'),
    );
    const ahuHistory = call(
      'get_recent_observations',
      { device_id: 'AHU03' },
      tools.get_recent_observations('AHU03'),
    );
    const evObs = evs
      .map((e) => state.observations.find((o) => o.id === e.source_observation_id))
      .filter(Boolean);
    const contextObs = currentRun.obs.filter((o) => ['W01', 'OCC03'].includes(o.device_id));
    const evidence = [...evObs, ...contextObs];
    const analysis = {
      id: uid('ANA'),
      incident_id: incident.id,
      version: 1,
      summary:
        'HVAC 與整棟用電同時偏高，而目前人流為 LOW、室外溫度僅 27°C。這些條件不足以直接證明設備故障，但值得檢查 AHU 排程、控制設定與設備效率。',
      hypotheses: [
        {
          description: '相較於目前人流與室外條件，空調用電需求可能偏高。',
          evidence_ids: evidence.map((x) => x.id),
          evidence_strength: 'MEDIUM',
        },
      ],
      recommended_actions: [
        {
          target_device_id: 'AHU03',
          action_type: 'INSPECT',
          reason: '檢查 AHU 排程與近期運轉趨勢，由管理者評估後續處置。',
        },
      ],
      model: 'building-aware-agent-v0.1',
      created_at: new Date().toISOString(),
    };
    state.analyses.push(analysis);
    incident.status = 'ANALYZED';
    return { log, analysis };
  }
  return { log, analysis: null };
}

function querySnapshot(deviceId) {
  let snapshot = null;
  for (const t of currentRun.tools) {
    if (Array.isArray(t.result)) {
      const d = t.result.find((x) => x && typeof x === 'object' && x.id === deviceId && x.capabilities);
      if (d) snapshot = { ...d, capabilities: [...d.capabilities] };
    }
    if (t.args?.device_id === deviceId) {
      if (t.name === 'get_device_state') snapshot = { ...(snapshot || { id: deviceId }), state: t.result };
      if (t.name === 'get_device_capabilities')
        snapshot = { ...(snapshot || { id: deviceId }), capabilities: [...t.result] };
      if (t.name === 'get_recent_observations')
        snapshot = {
          ...(snapshot || { id: deviceId }),
          recentObservations: t.result.map((o) => ({ ...o })),
        };
    }
  }
  return snapshot;
}

export { tools, runAgent, querySnapshot };
