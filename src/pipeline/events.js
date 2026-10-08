// 步驟 3：deterministic rule 判定。AI 不參與這一步。
// rule 的 text 會顯示在畫面上，新增或修改門檻時要一起更新。
import { uid } from '../dom.js';
import { state } from '../state.js';

function detectEvents(obsBatch) {
  const out = [];
  for (const o of obsBatch) {
    let e = null;
    // rule_text 是給畫面看的條件說明：原本門檻只存在於程式碼，
    // 使用者只看得到 RULE-W01 這個代號，無從判斷「為什麼這筆成立」。
    if (o.system === 'weather' && o.metric === 'rainfall' && o.value_numeric > 30)
      e = { type: 'HEAVY_RAINFALL', severity: 'warning', rule: 'RULE-W01', text: 'rainfall > 30 mm/h' };
    if (o.system === 'lake' && o.metric === 'water_level' && o.value_numeric > 80)
      e = { type: 'HIGH_WATER_LEVEL', severity: 'warning', rule: 'RULE-L01', text: 'water_level > 80 cm' };
    if (o.system === 'irrigation' && o.metric === 'status' && o.value_text === 'RUNNING')
      e = { type: 'IRRIGATION_ACTIVE', severity: 'info', rule: 'RULE-I01', text: 'status = RUNNING' };
    if (o.system === 'hvac' && o.metric === 'power' && o.value_numeric > 85)
      e = { type: 'HVAC_HIGH_CONSUMPTION', severity: 'warning', rule: 'RULE-H01', text: 'power > 85 kW' };
    if (o.system === 'energy' && o.metric === 'power' && o.value_numeric > 170)
      e = { type: 'BUILDING_ENERGY_HIGH', severity: 'warning', rule: 'RULE-E01', text: 'power > 170 kW' };
    if (e) {
      // deterministic rule 的同樣輸入必須得到同樣輸出：同一筆 Observation 經同一條規則
      // 只會有一個 Event，重跑情境不應再生出一筆內容相同、ID 不同的判定。
      const existing = state.events.find(
        (x) => x.source_observation_id === o.id && x.rule_id === e.rule,
      );
      if (existing) {
        out.push(existing);
        continue;
      }
      const event = {
        id: uid('EVT'),
        event_type: e.type,
        severity: e.severity,
        source_observation_id: o.id,
        device_id: o.device_id,
        zone_id: o.zone_id,
        rule_id: e.rule,
        rule_text: e.text,
        started_at: o.observed_at,
        status: 'ACTIVE',
      };
      state.events.push(event);
      out.push(event);
    }
  }
  return out;
}

export { detectEvents };
