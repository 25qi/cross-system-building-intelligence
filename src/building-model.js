// Structured Digital Twin：建築的靜態模型。
// relationships 不只是 AI 查詢的參考資料，也是 correlate() 推導語意關聯的輸入。
const buildingModel = {
  building: {
    id: 'BLDG-01',
    name: '宏道智慧社區',
    description: 'Synthetic building context inspired by public smart-community scenarios.',
  },
  zones: [
    { id: 'OUTDOOR', name: '戶外／湖區', parent: null },
    { id: 'TOWER-A', name: 'A 棟', parent: null },
    { id: 'TOWER-A-L3', name: 'A 棟 · 三樓', parent: 'TOWER-A' },
  ],
  devices: [
    {
      id: 'W01',
      name: '氣象站',
      system: 'weather',
      type: 'weather_station',
      zone: 'OUTDOOR',
      capabilities: ['READ_RAINFALL', 'READ_TEMPERATURE'],
      state: 'ONLINE',
    },
    {
      id: 'LS01',
      name: '湖面感測器',
      system: 'lake',
      type: 'lake_sensor',
      zone: 'OUTDOOR',
      capabilities: ['READ_WATER_LEVEL', 'READ_TURBIDITY'],
      state: 'ONLINE',
    },
    {
      id: 'IRR01',
      name: '灌溉控制器',
      system: 'irrigation',
      type: 'irrigation_controller',
      zone: 'OUTDOOR',
      capabilities: ['START', 'STOP', 'GET_STATUS'],
      state: 'RUNNING',
    },
    {
      id: 'DP01',
      name: '排水泵',
      system: 'drainage',
      type: 'drainage_pump',
      zone: 'OUTDOOR',
      capabilities: ['START', 'STOP', 'GET_STATUS'],
      state: 'STANDBY',
    },
    {
      id: 'AHU03',
      name: 'AHU-03',
      system: 'hvac',
      type: 'air_handling_unit',
      zone: 'TOWER-A-L3',
      capabilities: ['GET_STATUS', 'READ_POWER', 'READ_SCHEDULE'],
      state: 'RUNNING',
    },
    {
      id: 'EM01',
      name: '總電表',
      system: 'energy',
      type: 'energy_meter',
      zone: 'TOWER-A',
      capabilities: ['READ_POWER'],
      state: 'ONLINE',
    },
    {
      id: 'OCC03',
      name: '三樓人流感測器',
      system: 'occupancy',
      type: 'occupancy_sensor',
      zone: 'TOWER-A-L3',
      capabilities: ['READ_OCCUPANCY'],
      state: 'ONLINE',
    },
  ],
  // 關聯判定靠這張圖推導語意，因此每個設備都要有指向「關注對象」的邊。
  // IRR01 operates / DP01 drains 是 PRD 第 7 節有、但先前程式碼漏掉的。
  relationships: [
    ['W01', 'influences', 'IRR01'],
    ['W01', 'affects', 'OUTDOOR'],
    ['LS01', 'monitors', 'OUTDOOR'],
    ['IRR01', 'operates', 'OUTDOOR'],
    ['DP01', 'drains', 'OUTDOOR'],
    ['DP01', 'controls', 'lake_water_level'],
    ['AHU03', 'serves', 'TOWER-A-L3'],
    ['EM01', 'measures', 'TOWER-A'],
    ['OCC03', 'describes', 'TOWER-A-L3'],
  ],
};

// 每個子系統送出自己的原生格式：欄位名稱、時間表示法與數值包法都不同。

const deviceName = (id) => buildingModel.devices.find((d) => d.id === id)?.name || id;
const zoneName = (id) => buildingModel.zones.find((z) => z.id === id)?.name || id;
const isZone = (id) => buildingModel.zones.some((z) => z.id === id);

// 兩個 zone 是否相關：同一區，或其中一個是另一個的上層（A 棟三樓 ⊂ A 棟）。
function zonesRelated(a, b) {
  if (a === b) return true;
  const chain = (z) => {
    const path = [];
    let cur = buildingModel.zones.find((x) => x.id === z);
    while (cur) {
      path.push(cur.id);
      cur = cur.parent ? buildingModel.zones.find((x) => x.id === cur.parent) : null;
    }
    return path;
  };
  return chain(a).includes(b) || chain(b).includes(a);
}

// 這個設備在關係圖上指向哪些對象
const deviceTargets = (deviceId) =>
  buildingModel.relationships.filter((r) => r[0] === deviceId).map((r) => r[2]);

// 這個 Event 的來源設備，是否指向規則關注的對象
function eventPointsAt(event, feature) {
  return deviceTargets(event.device_id).some(
    (t) => t === feature || (isZone(t) && isZone(feature) && zonesRelated(t, feature)),
  );
}
export { buildingModel, deviceName, zoneName, isZone, zonesRelated, deviceTargets, eventPointsAt };
