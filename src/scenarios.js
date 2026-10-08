// 四組情境的原生 telemetry payload 與說明文案。
// 每個子系統用自己的格式，不可預先統一 —— 見 CLAUDE.md「Telemetry 是刻意異質的」。
const scenarios = {
  lake: {
    name: '情境 A · 強降雨、湖面水位與灌溉',
    payloads: [
      // 氣象站：epoch 毫秒，指標名稱內含單位
      {
        source: 'WEATHER_STATION',
        msg_id: 'SRC-W-001',
        station: 'W01',
        observed_epoch_ms: 1791357480000,
        rainfall_mm_per_h: 38.2,
      },
      // 湖面感測器：UTC 時間，數值包在巢狀物件，單位用 uom
      {
        source: 'LAKE_SENSOR',
        seq: 'SRC-L-001',
        sensorId: 'LS01',
        measuredAt: '2026-10-07T07:19:00Z',
        reading: { quantity: 'water_level', value: 82, uom: 'cm' },
      },
      // 灌溉控制器：本地時間字串，狀態沒有單位
      {
        source: 'IRRIGATION_CTRL',
        event_ref: 'SRC-I-001',
        controller_id: 'IRR01',
        state: 'RUNNING',
        local_time: '2026/10/07 15:19:10',
      },
      // 排水泵（BACnet 風格）：數值 present-value 搭配狀態字典
      {
        source: 'BACNET',
        notificationId: 'SRC-D-001',
        objectName: 'DP01',
        presentValue: 0,
        stateText: ['STANDBY', 'RUNNING'],
        timestamp: '2026-10-07T15:19:15+08:00',
      },
    ],
  },
  hvac: {
    name: '情境 B · 空調、用電與人流',
    payloads: [
      {
        source: 'WEATHER_STATION',
        msg_id: 'SRC-W-002',
        station: 'W01',
        observed_epoch_ms: 1791352800000,
        air_temp_c: 27,
      },
      // 人流節點：epoch 秒
      {
        source: 'OCCUPANCY_NODE',
        uplinkId: 'SRC-O-001',
        node: 'OCC03',
        occupancy: 'LOW',
        epoch: 1791352803,
      },
      // BMS：一次送一組 points 陣列
      {
        source: 'BMS_POINTS',
        batchId: 'SRC-H-001',
        equip: 'AHU03',
        tsLocal: '2026-10-07 14:00:05',
        points: [{ name: 'power', val: 92, unit: 'kW' }],
      },
      // 電表：欄位名稱就是單位
      { source: 'METER', readingId: 'SRC-E-001', meter: 'EM01', kW: 186, readAt: '2026-10-07T06:00:08Z' },
    ],
  },
  rainOnly: {
    name: '反例 C · 僅有強降雨',
    payloads: [
      {
        source: 'WEATHER_STATION',
        msg_id: 'SRC-W-003',
        station: 'W01',
        observed_epoch_ms: 1791360000000,
        rainfall_mm_per_h: 38.2,
      },
      {
        source: 'LAKE_SENSOR',
        seq: 'SRC-L-003',
        sensorId: 'LS01',
        measuredAt: '2026-10-07T08:00:15Z',
        reading: { quantity: 'water_level', value: 58, uom: 'cm' },
      },
    ],
  },
  legitHvac: {
    name: '反例 D · 合理的空調高負載',
    payloads: [
      {
        source: 'WEATHER_STATION',
        msg_id: 'SRC-W-004',
        station: 'W01',
        observed_epoch_ms: 1791349200000,
        air_temp_c: 35,
      },
      {
        source: 'OCCUPANCY_NODE',
        uplinkId: 'SRC-O-004',
        node: 'OCC03',
        occupancy: 'HIGH',
        epoch: 1791349202,
      },
      {
        source: 'BMS_POINTS',
        batchId: 'SRC-H-004',
        equip: 'AHU03',
        tsLocal: '2026-10-07 13:00:04',
        points: [{ name: 'power', val: 94, unit: 'kW' }],
      },
      { source: 'METER', readingId: 'SRC-E-004', meter: 'EM01', kW: 189, readAt: '2026-10-07T05:00:06Z' },
    ],
  },
};

const scenarioBriefs = {
  lake: {
    title: '情境描述 · 情境 A — 強降雨、湖面水位與灌溉',
    body: '智慧社區的戶外湖區正遭遇強降雨。氣象站量到 <b>38.2 mm/h</b>，湖面水位升至 <b>82 cm</b>；同一時間，灌溉控制器 <b>IRR01 仍為 RUNNING</b>，排水泵 <b>DP01 為 STANDBY</b>。管理者面對的不是單一警報，而是多個原本分散在不同系統中的訊號。此展示示範後端如何保留原始 Observation、產生 依規則判定的 Event、建立跨系統 Incident，再讓 AI 透過 Building Context 查詢工具查詢設備與狀態後提出有證據依據的建議。',
    goal: '<b>展示目標：</b>人工核准 IRR01 STOP 後，新的設備狀態會成為一筆新 Observation 回到資料處理流程，形成可稽核的回饋循環。',
  },
  hvac: {
    title: '情境描述 · 情境 B — 空調、用電與人流',
    body: '大樓三樓目前人流偏低，室外溫度僅 <b>27°C</b>，但 AHU-03 用電達 <b>92 kW</b>，整棟建築用電為 <b>186 kW</b>。系統需要結合人流、氣象、空調與用電資料，判斷高能耗是否值得進一步調查，而不是只因單一數值偏高就直接宣告設備故障。',
    goal: '<b>展示目標：</b>驗證同一套 跨系統架構 能跨領域使用，並維持「AI 提出推論假設，不把推論當成已驗證事實」的邊界。',
  },
  rainOnly: {
    title: '情境描述 · 反例 C — 僅有強降雨',
    body: '系統偵測到 <b>38.2 mm/h</b> 的強降雨，但湖面水位仍為正常的 <b>58 cm</b>。這個案例刻意提供部分訊號，測試 關聯判定機制 是否會因為「看到大雨」就過度建立 湖區風險 Incident。',
    goal: '<b>展示目標：</b>系統應保持克制；證據不足時不建立跨系統 Incident。',
  },
  legitHvac: {
    title: '情境描述 · 反例 D — 合理的空調高負載',
    body: 'AHU 用電與建築總用電都偏高，但同時室外溫度為 <b>35°C</b>、人流為 <b>HIGH</b>。高 空調負載 在這些條件 下可能合理，因此不應只看功率門檻就產生異常結論。',
    goal: '<b>展示目標：</b>驗證系統能利用建築脈絡降低誤報，而不是「數值高 = 異常」。',
  },
};
// 下拉選單只看得到情境名稱，用一行提示補上原本副標承載的「這個情境在測什麼」。
const scenarioHints = {
  lake: '強降雨、湖面水位與灌溉同時發生，預期建立 Incident 並提出可執行建議。',
  hvac: '空調、用電與人流交叉比對，預期只提出調查建議，不宣稱設備故障。',
  rainOnly: '只有強降雨、水位正常，預期不建立 Incident。',
  legitHvac: '高溫加高人流可合理解釋高負載，預期不建立 Incident。',
};

export { scenarios, scenarioBriefs, scenarioHints };
