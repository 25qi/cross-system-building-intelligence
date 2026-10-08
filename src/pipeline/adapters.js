// 每個 telemetry 來源一個 adapter。新增子系統時必須在此加對應項目，
// 否則 normalize() 會丟「未知的 telemetry 來源」。
// 每個子系統一個 adapter，把原生 payload 的欄位名稱、時間格式與數值包法
// 轉成統一的中間結果。這是步驟 2 真正在做的事。
const telemetryAdapters = {
  WEATHER_STATION: (p) => {
    const rain = 'rainfall_mm_per_h' in p;
    return {
      source_event_id: p.msg_id,
      device_id: p.station,
      metric: rain ? 'rainfall' : 'temperature',
      value: rain ? p.rainfall_mm_per_h : p.air_temp_c,
      unit: rain ? 'mm/h' : '°C',
      observed_at: new Date(p.observed_epoch_ms).toISOString(),
    };
  },
  LAKE_SENSOR: (p) => ({
    source_event_id: p.seq,
    device_id: p.sensorId,
    metric: p.reading.quantity,
    value: p.reading.value,
    unit: p.reading.uom,
    observed_at: new Date(p.measuredAt).toISOString(),
  }),
  IRRIGATION_CTRL: (p) => ({
    source_event_id: p.event_ref,
    device_id: p.controller_id,
    metric: 'status',
    value: p.state,
    unit: null,
    // 本地時間字串沒有時區，依場域時區（+08:00）解讀
    observed_at: new Date(p.local_time.replace(/\//g, '-').replace(' ', 'T') + '+08:00').toISOString(),
  }),
  BACNET: (p) => ({
    source_event_id: p.notificationId,
    device_id: p.objectName,
    metric: 'status',
    // present-value 是索引，要用 stateText 字典翻回狀態名稱
    value: p.stateText[p.presentValue],
    unit: null,
    observed_at: new Date(p.timestamp).toISOString(),
  }),
  BMS_POINTS: (p) => {
    const point = p.points[0];
    return {
      source_event_id: p.batchId,
      device_id: p.equip,
      metric: point.name,
      value: point.val,
      unit: point.unit,
      observed_at: new Date(p.tsLocal.replace(' ', 'T') + '+08:00').toISOString(),
    };
  },
  METER: (p) => ({
    source_event_id: p.readingId,
    device_id: p.meter,
    metric: 'power',
    value: p.kW,
    unit: 'kW',
    observed_at: new Date(p.readAt).toISOString(),
  }),
  OCCUPANCY_NODE: (p) => ({
    source_event_id: p.uplinkId,
    device_id: p.node,
    metric: 'level',
    value: p.occupancy,
    unit: null,
    observed_at: new Date(p.epoch * 1000).toISOString(),
  }),
};

export { telemetryAdapters };
