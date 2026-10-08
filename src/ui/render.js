// 各階段資料卡與審核區塊的渲染。
// 核准／拒絕的處理函式由 app.js 以 setReviewHandlers() 注入，避免與 app 形成循環 import。
import { $, $$, esc } from '../dom.js';
import { deviceName, zoneName } from '../building-model.js';
import { state, currentRun, stateOf } from '../state.js';
import { getLastCorrelation, CORRELATION_WINDOW_MIN } from '../pipeline/correlate.js';
import { querySnapshot } from '../pipeline/agent.js';
import { isBusy } from './flow.js';
import { renderContext } from './scene.js';

let onApprove = () => {};
let onReject = () => {};
const setReviewHandlers = (approve, reject) => { onApprove = approve; onReject = reject; };

function renderCurrent() {
  $('#rawTelemetry').innerHTML = currentRun.raw.length
    ? currentRun.raw
        .map(
          (p) =>
            `<div class="raw-payload"><b>${esc(p.source)}</b><pre>${esc(JSON.stringify(p, null, 1))}</pre></div>`,
        )
        .join('')
    : '<div class="empty">請執行情境以接收遙測資料。</div>';
  $('#observations').innerHTML = currentRun.obs.length
    ? currentRun.obs
        .map(
          (o) =>
            `<div class="metric"><b>${esc(o.id)} · ${esc(o.device_id)}.${esc(o.metric)}</b><span>${esc(o.value_numeric ?? o.value_text)} ${esc(o.unit || '')}</span></div>`,
        )
        .join('')
    : '<div class="empty">尚無 Observation 紀錄。</div>';
  $('#events').innerHTML = currentRun.events.length
    ? currentRun.events
        .map(
          (e) =>
            `<div class="event"><b>${esc(e.event_type)}</b> <span class="pill ${e.severity === 'warning' ? 'warn' : 'info'}">${esc(e.severity)}</span><div class="obs-row"><span>ID</span><div>${esc(e.id)}</div></div><div class="obs-row"><span>規則</span><div>${esc(e.rule_id)}：${esc(e.rule_text || '')}</div></div><div class="obs-row"><span>來源</span><div>${esc(e.source_observation_id)}</div></div></div>`,
        )
        .join('')
    : '<div class="empty">未產生規則判定 Event；部分反例情境預期會有此結果。</div>';

  // 步驟 4 要說明「怎麼判的」，不只是結果：三個條件逐條列出，
  // 不成立時指出卡在哪一條（對照步驟 3 顯示 RULE-xx 的作法）。
  // 「間隔」是最早與最晚那個 Event 的時間差；窗是允許的上限。
  // 兩個分支共用同一句，避免成立與不成立的措辭不一致。
  const temporalText = (count, spanSec, windowMin) =>
    `${count} 個 Event 最早到最晚相差 ${spanSec} 秒，${spanSec <= windowMin * 60 ? '未超過' : '超過'} ${windowMin} 分鐘的時間窗`;
  const corrRow = (label, ok, text) =>
    `<div class="obs-row"><span>${label}</span><div>${ok ? '✓' : '✗'} ${esc(text)}</div></div>`;
  const inc = currentRun.incident;
  const ev = getLastCorrelation();
  if (inc) {
    $('#incidentBox').innerHTML =
      `<div class="incident"><div><span class="pill bad">${esc(inc.severity)}</span></div><h3 style="margin-top:8px">${esc(inc.title)}</h3><div class="small">${esc(inc.id)} · ${esc(inc.incident_type)} · ${esc(inc.zone_id)}</div>` +
      `<div class="obs-row"><span>規則</span><div>${esc(inc.rule_id)}</div></div>` +
      corrRow('語意', true, inc.rule_semantic) +
      corrRow('時間', true, temporalText(inc.event_ids.length, inc.span_sec, inc.window_min)) +
      corrRow(
        '區域',
        true,
        inc.zones.join('、') + (inc.zones.length > 1 ? '（同一棟的上下層）' : '（同一區）'),
      ) +
      (inc.rule_context ? corrRow('脈絡', true, inc.rule_context) : '') +
      `</div>`;
  } else {
    $('#incidentBox').innerHTML =
      `<div class="incident none"><b>未建立 Incident。</b>` +
      (ev
        ? `<div class="obs-row"><span>規則</span><div>${esc(ev.rule.id)}</div></div>` +
          corrRow('語意', ev.semantic, ev.semantic_text) +
          (ev.semantic
            ? corrRow(
                '時間',
                ev.temporal,
                temporalText(ev.matched.length, ev.spanSec, CORRELATION_WINDOW_MIN),
              )
            : '') +
          (ev.semantic ? corrRow('區域', ev.spatial, ev.zones.join('、')) : '') +
          (ev.rule.context_text ? corrRow('脈絡', ev.context, ev.rule.context_text) : '')
        : '') +
      `<p class="small">條件未全部成立，因此不建立 Incident，也不啟動 AI 分析。</p></div>`;
  }

  $('#toolLog').innerHTML = currentRun.tools.length
    ? currentRun.tools
        .map(
          (t) =>
            `<div class="tool"><b>${esc(t.name)}</b>(${esc(JSON.stringify(t.args))})<br><span class="muted">→ ${esc(Array.isArray(t.result) ? t.result.map((x) => x.id || x.name || x.event_type || x).join(', ') : JSON.stringify(t.result))}</span></div>`,
        )
        .join('')
    : '<div class="empty">尚無工具查詢。</div>';

  if (currentRun.analysis) {
    const a = currentRun.analysis;
    const h = a.hypotheses[0];
    $('#analysisBox').innerHTML =
      `<p>${esc(a.summary)}</p><div style="margin-top:12px"><b>推論假設</b><div class="evidence">${esc(h.description)}</div><div class="small">證據強度： <b>${esc(h.evidence_strength)}</b></div></div><div style="margin-top:10px"><b>證據參照</b>${h.evidence_ids
        .map((id) => {
          const o = state.observations.find((x) => x.id === id);
          return `<div class="evidence">${esc(id)} · ${esc(o?.device_id)}.${esc(o?.metric)} = ${esc(o?.value_numeric ?? o?.value_text)} ${esc(o?.unit || '')}</div>`;
        })
        .join('')}</div>`;
  } else $('#analysisBox').innerHTML = '<div class="empty">未建立 Incident，因此未進行 AI 分析。</div>';

  if (currentRun.action) {
    const a = currentRun.action;
    let html = `<div class="action"><b>${esc(a.action_type)} · ${esc(a.target_device_id)}</b><p>${esc(a.reason)}</p><div class="small">狀態： <b>${esc(a.status)}</b></div>`;
    if (a.status === 'PROPOSED')
      html += `<div class="actionbuttons"><button class="danger" id="rejectAction">拒絕</button><button class="primary" id="approveAction">核准操作</button></div>`;
    html += '</div>';
    if (a.status === 'REJECTED')
      html += `<div class="success" style="border-color:#f1c3be;background:#fff7f6"><b>管理者已拒絕此操作。</b></div>`;
    $('#actionBox').innerHTML = html;
    $('#approveAction')?.addEventListener('click', () => onApprove(a));
    if ($('#approveAction')) $('#approveAction').disabled = isBusy();
    if ($('#rejectAction')) $('#rejectAction').disabled = isBusy();
    $('#rejectAction')?.addEventListener('click', () => onReject(a));
  } else $('#actionBox').innerHTML = '<div class="empty">尚無建議操作。</div>';
  const action = currentRun.action;
  // 情境選擇移入右欄後這一欄變長，待審核的操作卡片容易落在捲動範圍外。
  // PROPOSED 期間把它釘在面板底部，確保核准／拒絕一定看得到；
  // 此時 executionBox 與 feedbackBox 都還是空的，不會被蓋住。
  $('#decisionSection').classList.toggle('awaiting-review', action?.status === 'PROPOSED');
  $('#executionBox').innerHTML =
    action?.status === 'EXECUTED'
      ? '<div class="success"><b>操作執行成功</b><p>IRR01: RUNNING → STOPPED</p></div>'
      : action?.status === 'REJECTED'
        ? `<div class="evidence"><b>Action 未執行</b><p class="small">execution_status = NOT_EXECUTED_REJECTED；未送出任何控制指令，設備狀態維持原樣。</p><p class="small">處置結果已寫入 ${esc(action.id)}，可於稽核鏈與保存紀錄查看。</p></div>`
        : action?.status === 'APPROVED'
          ? '<p>檢查建議已核准，待管理者安排設備檢查。</p>'
          : '';
  const feedback = currentRun.obs.find((o) => o.id === 'OBS-036');
  $('#feedbackBox').innerHTML = feedback
    ? '<div class="success"><b>新增 Observation：OBS-036</b><p>IRR01.status = STOPPED</p><p class="small">已新增至 Observation 資料儲存區，並回到相同的資料處理流程。</p></div>'
    : '';
  renderDecision();
  renderContext();
}

function renderDecision() {
  const obs = currentRun.obs.filter((o) => o.id !== 'OBS-036');
  const incident = currentRun.incident;
  $('#decisionEvidence').innerHTML = `${obs
    .map((o) => {
      const event = currentRun.events.find((e) => e.source_observation_id === o.id);
      const rows = [
        ['ID', esc(o.id)],
        ['設備', `${esc(o.device_id)} · ${esc(deviceName(o.device_id))}`],
        ['項目', esc(o.metric)],
        [
          '判定',
          event
            ? `${esc(event.event_type)}<br><span class="rule">${esc(event.rule_id)}：${esc(event.rule_text || '')}</span>`
            : '未命中任何規則，不產生 Event',
        ],
      ];
      return `<div class="evidence"><b class="obs-value">${esc(o.value_numeric ?? o.value_text)} ${esc(o.unit || '')}</b>${rows
        .map(([k, v]) => `<div class="obs-row"><span>${k}</span><div>${v}</div></div>`)
        .join('')}</div>`;
    })
    .join('')}`;
  if (currentRun.analysis) {
    const rec = currentRun.analysis.recommended_actions?.[0];
    const snap = rec ? querySnapshot(rec.target_device_id) : null;
    const basis = rec
      ? rec.action_type === 'STOP'
        ? `<div class="evidence"><b>可執行依據 · 查詢快照</b><br>${esc(rec.target_device_id)} capability 包含 <b>STOP</b><br>查詢時 state = <b>${esc(snap?.state)}</b><div class="small">目前 state = ${esc(stateOf(rec.target_device_id))}；人工核准前不送出控制指令。</div></div>`
        : `<div class="evidence"><b>檢查依據</b><br>${esc(rec.target_device_id)}：${esc(snap?.state)}<br>${esc(snap?.capabilities?.join(', '))}<div class="small">INSPECT 是管理者檢查任務；本原型不執行空調控制。</div></div>`
      : '';
    $('#decisionRecommendation').innerHTML =
      `<p style="font-size:12px">${esc(currentRun.analysis.summary)}</p>${basis}<div class="small">Inference: ${esc(currentRun.analysis.hypotheses[0].description)}<br>證據強度：${esc(currentRun.analysis.hypotheses[0].evidence_strength)}</div>`;
  } else
    $('#decisionRecommendation').innerHTML =
      `<div class="empty">${obs.length ? '未啟動 AI；沒有建議操作。' : '等待事件證據與建築脈絡。'}</div>`;
  renderAudit();
}
function renderAudit() {
  const facts = currentRun.obs.filter((o) => o.id !== 'OBS-036');
  const groups = [
    facts.map((o) => o.id).join(', '),
    currentRun.events.map((e) => e.id).join(', '),
    currentRun.incident?.id,
    currentRun.analysis?.id,
    currentRun.action ? `${currentRun.action.id} · ${currentRun.action.status}` : null,
    currentRun.obs.find((o) => o.id === 'OBS-036') ? 'OBS-036 · IRR01 STOPPED → Observation' : null,
  ].filter(Boolean);
  $('#auditLine').innerHTML =
    `<strong>Audit lineage</strong>${groups.length ? groups.map((id) => `<span class="audit-item">${esc(id)}</span>`).join('<span class="audit-arrow">→</span>') : '<span>執行情境後記錄事實、推論、審核與處置關聯。</span>'}`;
}

function renderStore() {
  if (!$('#obsStore') || !$('#eventStore') || !$('#derivedStore') || !$('#actionStore')) return;
  const obs = state.observations.slice(-12).reverse();
  $('#obsStore').innerHTML = obs.length
    ? `<table class="table"><thead><tr><th>ID</th><th>設備代碼／資料項目</th><th>數值</th></tr></thead><tbody>${obs.map((o) => `<tr><td>${esc(o.id)}</td><td>${esc(o.device_id)}.${esc(o.metric)}</td><td>${esc(o.value_numeric ?? o.value_text)} ${esc(o.unit || '')}</td></tr>`).join('')}</tbody></table>`
    : '<div class="empty">尚無已保存的 Observation。</div>';
  // Event 是六層保存紀錄之一（設計說明 §12），稽核時要能回答
  // 「這筆事實經哪一條規則、判成什麼」，因此獨立成一欄。
  const evs = state.events.slice(-8).reverse();
  $('#eventStore').innerHTML = evs.length
    ? evs
        .map(
          (e) =>
            `<div class="evidence"><b>${esc(e.id)}</b> · ${esc(e.event_type)}<div class="small">${esc(e.rule_id)}：${esc(e.rule_text || '')}<br>來源 ${esc(e.source_observation_id)}</div></div>`,
        )
        .join('')
    : '<div class="empty">尚無規則判定 Event。</div>';
  const incs = state.incidents.slice(-5).reverse(),
    ans = state.analyses.slice(-5).reverse();
  $('#derivedStore').innerHTML =
    `<h3>Incident 紀錄</h3>${incs.length ? incs.map((i) => `<div class="evidence"><b>${esc(i.id)}</b> · ${esc(i.incident_type)} · ${esc(i.status)}</div>`).join('') : '<div class="empty">尚無紀錄，請執行可建立 Incident 的情境。</div>'}<h3 style="margin-top:14px">分析紀錄</h3>${ans.length ? ans.map((a) => `<div class="evidence"><b>${esc(a.id)}</b> · 對應 Incident ${esc(a.incident_id)} · v${esc(a.version)}</div>`).join('') : '<div class="empty">尚無紀錄，請執行可建立 Incident 的情境。</div>'}`;
  const acts = state.actions.slice(-8).reverse();
  $('#actionStore').innerHTML = acts.length
    ? acts
        .map(
          (a) =>
            `<div class="evidence"><b>${esc(a.id)}</b> · ${esc(a.action_type)} ${esc(a.target_device_id)} · <b>${esc(a.status)}</b></div>`,
        )
        .join('')
    : '<div class="empty">尚無操作進入審核或執行流程。</div>';
}

export { renderCurrent, renderDecision, renderAudit, renderStore, setReviewHandlers };
