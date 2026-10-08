// DOM 與字串工具：整個專案最底層，不依賴任何其他模組。
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
// 同一毫秒內會產生多筆紀錄，純隨機尾碼會碰撞 —— 實測出現過兩筆 Observation
// 共用同一個 ID，稽核鏈因此指不回唯一的來源。改為「本次載入的隨機鹽 + 遞增序號」：
// 序號保證同一次載入內唯一，鹽讓不同次載入的紀錄不會互撞。
const idSalt = Math.random().toString(36).slice(2, 5);
let idSeq = 0;
function uid(prefix) {
  return `${prefix}-${idSalt}-${String(++idSeq).padStart(3, '0')}`;
}
function esc(v) {
  return String(v ?? '').replace(
    /[&<>"']/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m],
  );
}
export { $, $$, uid, esc };
