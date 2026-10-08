// 呼吸燈：全域只維持一組，開新的一組會先停掉前一組。
// 只用在「核准並實際執行操作後」，不是回應每一次點擊。
// 畫面會有多處同時呼吸，看不出哪一個才是剛剛變動的；改為開新的就先停掉舊的。
let pulsingNodes = [];
let pulseTimer = null;
function stopPulse() {
  if (pulseTimer) {
    clearTimeout(pulseTimer);
    pulseTimer = null;
  }
  pulsingNodes.forEach((node) => node.classList.remove('state-pulse'));
  pulsingNodes = [];
}
function pulseNodes(nodes) {
  stopPulse();
  pulsingNodes = [...new Set(nodes.filter(Boolean))];
  if (!pulsingNodes.length) return;
  pulsingNodes.forEach((node) => {
    // 讀一次版面強制 reflow，剛移除的動畫才會重新開始播放
    if (typeof node.getBoundingClientRect === 'function') node.getBoundingClientRect();
    node.classList.add('state-pulse');
  });
  pulseTimer = setTimeout(stopPulse, 3000);
}
// 回傳與這些設備有關的所有畫面節點（場景標籤、圖釘、HUD 讀數、左欄狀態）。
// 不自己點亮，否則呼叫端要再點亮別的節點時會把這一組取消掉。

export { pulseNodes, stopPulse };
