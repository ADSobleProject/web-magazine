// 요소를 만드는 작은 도우미. 데이터는 항상 텍스트 노드로 넣으므로(innerHTML 미사용) 기사 제목 등에
// HTML이 섞여 있어도 실행되지 않는다.
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

export function announce(message) {
  const live = document.getElementById('live');
  if (!live) return;
  live.textContent = '';
  // 같은 문구가 반복되어도 화면 낭독기가 다시 읽도록 한 박자 뒤에 넣는다.
  setTimeout(() => { live.textContent = message; }, 50);
}
