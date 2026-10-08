// 步驟 4：跨系統關聯。語意由 buildingModel 的關係圖推導，規則不列舉 Event 類型。
import { uid } from '../dom.js';
import { zonesRelated, eventPointsAt } from '../building-model.js';
import { state } from '../state.js';
import { latest } from './normalize.js';

let lastCorrelation = null;
const getLastCorrelation = () => lastCorrelation;

// 關聯規則：三個條件都要成立才建立 Incident（設計說明 Step 4 的 Temporal /
// Spatial / Semantic）。語意不再列舉 Event 類型，而是從 buildingModel
// 的關係圖推導：來源設備是否共同指向同一個關注對象。規則只宣告「這個對象
// 出事時叫什麼名字」與領域特有的排除條件。
const CORRELATION_WINDOW_MIN = 15;
const MIN_RISK_EVENTS = 2;
const correlationRules = [
  {
    id: 'CORR-01',
    feature: 'OUTDOOR',
    incident_type: 'WEATHER_RELATED_LAKE_RISK',
    title: '降雨相關湖區風險',
  },
  {
    id: 'CORR-02',
    feature: 'TOWER-A',
    incident_type: 'HVAC_ENERGY_EFFICIENCY_RISK',
    title: '空調與用電效率風險',
    // 高負載若能被外在條件合理解釋就不該報
    context_text: '室外溫度 ≤ 30°C 且人流 = LOW',
    context_test: (obsBatch) => {
      const temp = latest(obsBatch, 'weather', 'temperature');
      const occ = latest(obsBatch, 'occupancy', 'level');
      return !!(temp && occ && temp.value_numeric <= 30 && occ.value_text === 'LOW');
    },
  },
];

function evaluateCorrelation(rule, obsBatch, eventBatch) {
  // 語意：由關係圖推導 — 哪些 Event 的來源設備共同指向 rule.feature
  const linked = eventBatch.filter((e) => eventPointsAt(e, rule.feature));
  const risks = linked.filter((e) => e.severity === 'warning');
  const semantic = risks.length >= MIN_RISK_EVENTS;
  const semantic_text = semantic
    ? `${[...new Set(risks.map((e) => e.device_id))].join('、')} 的 Event 經關係圖共同指向 ${rule.feature}`
    : `指向 ${rule.feature} 的風險 Event 只有 ${risks.length} 個，需要 ${MIN_RISK_EVENTS} 個`;
  const times = linked.map((e) => new Date(e.started_at).getTime());
  const spanSec = times.length ? Math.round((Math.max(...times) - Math.min(...times)) / 1000) : 0;
  const temporal = semantic && spanSec <= CORRELATION_WINDOW_MIN * 60;
  const zones = [...new Set(linked.map((e) => e.zone_id))];
  const spatial = semantic && zones.every((z) => zonesRelated(z, zones[0]));
  const context = rule.context_test ? rule.context_test(obsBatch) : true;
  return {
    rule,
    semantic,
    semantic_text,
    temporal,
    spatial,
    context,
    matched: linked,
    risks,
    spanSec,
    zones,
  };
}

function correlate(obsBatch, eventBatch) {
  const evaluations = correlationRules.map((rule) => evaluateCorrelation(rule, obsBatch, eventBatch));
  // 都不成立時要指出「卡在哪」，所以報最接近成立的那條規則，而不是最後評估的那條。
  const progress = (ev) =>
    ev.risks.length * 10 + [ev.semantic, ev.temporal, ev.spatial, ev.context].filter(Boolean).length;
  lastCorrelation = evaluations.reduce((a, b) => (progress(b) > progress(a) ? b : a));
  for (const ev of evaluations) {
    if (!(ev.semantic && ev.temporal && ev.spatial && ev.context)) continue;
    lastCorrelation = ev;
    const rule = ev.rule;
    const inc = {
      id: uid('INC'),
      incident_type: rule.incident_type,
      title: rule.title,
      severity: 'MEDIUM',
      zone_id: ev.zones[0] || rule.feature,
      status: 'OPEN',
      created_at: new Date().toISOString(),
      event_ids: ev.matched.map((e) => e.id),
      rule_id: rule.id,
      rule_semantic: ev.semantic_text,
      rule_context: rule.context_text || null,
      feature_of_interest: rule.feature,
      window_min: CORRELATION_WINDOW_MIN,
      span_sec: ev.spanSec,
      zones: ev.zones,
    };
    state.incidents.push(inc);
    return inc;
  }
  return null;
}

export { correlate, getLastCorrelation, CORRELATION_WINDOW_MIN, MIN_RISK_EVENTS, correlationRules };
