// 2.5D 場景、設備脈絡面板與 HUD 讀數。
import { $, $$, esc } from '../dom.js';
import { buildingModel, deviceName, zoneName } from '../building-model.js';
import { state, currentRun, stateOf } from '../state.js';
import { querySnapshot } from '../pipeline/agent.js';

let selectedTwinDevice = 'IRR01';
const setSelectedTwinDevice = (id) => { selectedTwinDevice = id; };

function deviceNodes(deviceIds) {
  const ids = new Set(deviceIds);
  const nodes = $$('.scene-device, .scene-marker').filter((n) => ids.has(n.dataset.device));
  [0, 1, 2].forEach((i) => {
    const reading = $('#hudValue-' + i);
    if (reading && ids.has(reading.dataset.device)) nodes.push(reading);
  });
  if (ids.has(selectedTwinDevice)) nodes.push($('#selectedDeviceState'), $('#recentDeviceObservations'));
  return nodes;
}

function relatedDeviceIds(deviceId) {
  const ids = new Set();
  buildingModel.relationships.forEach((r) => {
    if (r[0] === deviceId && buildingModel.devices.some((d) => d.id === r[2])) ids.add(r[2]);
    if (r[2] === deviceId && buildingModel.devices.some((d) => d.id === r[0])) ids.add(r[0]);
  });
  return [...ids];
}

function renderDeviceDetail(deviceId) {
  const d = buildingModel.devices.find((x) => x.id === deviceId);
  if (!d) return;
  selectedTwinDevice = deviceId;
  const recent = state.observations
    .filter((o) => o.device_id === deviceId)
    .slice(-3)
    .reverse();
  const rel = buildingModel.relationships.filter((r) => r[0] === deviceId || r[2] === deviceId);
  $('#deviceDetail').innerHTML =
    `<div class="device-head" title="${esc(d.type)}"><span class="pill info">${esc(d.id)}</span><h3>${esc(d.name)}</h3></div>
    <div class="detail-row"><span>Zone</span><b>${esc(zoneName(d.zone))}</b></div>
    <div class="detail-row"><span>目前狀態</span><b id="selectedDeviceState">${esc(stateOf(d.id))}</b></div>
    <div class="detail-row"><span>Capabilities</span><div class="cap-list">${d.capabilities.map((c) => `<span class="cap">${esc(c)}</span>`).join('')}</div></div>
    <div class="detail-row"><span>近期事實</span><div id="recentDeviceObservations">${recent.length ? recent.map((o) => `<div class="small">${esc(o.id)}<br>${esc(o.metric)} = <b>${esc(o.value_numeric ?? o.value_text)}</b> ${esc(o.unit || '')}</div>`).join('') : '<span class="small">尚無 Observation</span>'}</div></div>
    <div class="relation-mini"><b>Relationships</b><br>${rel.length ? rel.map((r) => `${esc(r[0])} → ${esc(r[1])} → ${esc(r[2])}`).join('<br>') : '尚無關係資料'}</div>`;
  $$('.scene-device, .scene-marker').forEach((n) => {
    const selected = n.dataset.device === deviceId;
    n.classList.toggle('selected', selected);
    n.setAttribute('aria-pressed', String(selected));
  });
}
function renderContext() {
  $$('.scene-device').forEach((btn) => {
    btn.onclick = () => renderDeviceDetail(btn.dataset.device);
    btn.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        renderDeviceDetail(btn.dataset.device);
      }
    };
    const o = currentRun.obs.filter((o) => o.device_id === btn.dataset.device).slice(-1)[0];
    const reading = $('#nodeReading-' + btn.dataset.device);
    reading.textContent = o ? `${o.value_numeric ?? o.value_text} ${o.unit || ''}`.trim() : '';
    reading.hidden = !o;
  });
  // 窄視窗下標籤只剩設備代碼，場景上的圖釘也要能直接點選。
  $$('.scene-marker').forEach((marker) => {
    marker.onclick = () => renderDeviceDetail(marker.dataset.device);
  });
  renderDeviceDetail(selectedTwinDevice);
  updateTwinUsage(false);
  renderWorldReadings();
}

function renderWorldReadings() {
  const config = ['hvac', 'legitHvac'].includes(currentRun.scenario)
    ? [
        ['室外溫度', 'W01', 'temperature'],
        ['空調用電', 'AHU03', 'power'],
        ['三樓人流', 'OCC03', 'level'],
      ]
    : [
        ['降雨強度', 'W01', 'rainfall'],
        ['湖面水位', 'LS01', 'water_level'],
        ['灌溉狀態', 'IRR01', 'status'],
      ];
  config.forEach(([label, device, metric], i) => {
    const observation = currentRun.obs
      .filter((o) => o.device_id === device && o.metric === metric)
      .slice(-1)[0];
    $('#hudLabel-' + i).textContent = label;
    $('#hudValue-' + i).dataset.device = device;
    $('#hudValue-' + i).textContent = observation
      ? `${observation.value_numeric ?? observation.value_text} ${observation.unit || ''}`.trim()
      : '—';
    $('#hudSource-' + i).textContent = observation ? `${device} · ${observation.id}` : device;
  });
}
function contextDevicesFromTools() {
  const ids = new Set();
  currentRun.tools.forEach((t) => {
    if (t.args?.device_id) ids.add(t.args.device_id);
    if (Array.isArray(t.result))
      t.result.forEach((x) => {
        if (x && typeof x === 'object') {
          const id = x.device_id || x.id;
          if (buildingModel.devices.some((d) => d.id === id)) ids.add(id);
        }
      });
  });
  return [...ids];
}

function updateTwinUsage(active = false) {
  const ids = contextDevicesFromTools();
  $$('.scene-device, .scene-marker').forEach((n) =>
    n.classList.toggle('context-used', ids.includes(n.dataset.device)),
  );
  $$('.query-route').forEach((n) => n.classList.toggle('used', ids.includes(n.dataset.route)));
  const banner = $('#contextLiveBanner');
  banner.textContent = ids.length ? `${active ? 'AI 查詢' : '本次分析引用'} · ${ids.length} 個設備` : '';
  banner.classList.toggle('active', ids.length > 0);
  if (active && currentRun.incident)
    renderDeviceDetail(
      currentRun.incident.incident_type === 'WEATHER_RELATED_LAKE_RISK' ? 'IRR01' : 'AHU03',
    );
}

// Fit only the actual scene bounds; device labels keep their normal text size.
function fitScene() {
  const canvas = $('#sceneCanvas'),
    stage = canvas?.parentElement;
  if (!stage || !stage.clientWidth || !stage.clientHeight) return;
  const width = Math.min(stage.clientWidth, (stage.clientHeight * 875) / 420);
  canvas.style.width = width + 'px';
  canvas.style.height = (width * 420) / 875 + 'px';
}
if (typeof ResizeObserver !== 'undefined') {
  const stage = $('#sceneCanvas').parentElement;
  const sceneObserver = new ResizeObserver(fitScene);
  sceneObserver.observe(stage);
}
if (typeof window !== 'undefined') window.addEventListener('resize', fitScene);
fitScene();


export { deviceNodes, renderDeviceDetail, renderContext, renderWorldReadings, contextDevicesFromTools, updateTwinUsage, fitScene, selectedTwinDevice, setSelectedTwinDevice };
