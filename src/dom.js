// DOM 與字串工具：整個專案最底層，不依賴任何其他模組。
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
function uid(prefix) {
  return prefix + '-' + String(Date.now()).slice(-6) + '-' + Math.floor(Math.random() * 900 + 100);
}
function esc(v) {
  return String(v ?? '').replace(
    /[&<>"']/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m],
  );
}
export { $, $$, uid, esc };
