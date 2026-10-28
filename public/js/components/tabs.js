// 콘텐츠 탭: 세 탭의 목록을 처음에 모두 받아 두고, 전환할 때는 통신 없이 목록만 바꾼다(명세 3장 B).
// 키보드: 좌우 방향키, Home, End로 탭을 옮긴다.
import { el } from '../lib/dom.js';
import { articleCard, rankRow } from './cards.js';

// 순위 숫자를 붙일 탭
const RANKED = new Set(['popular', 'rising']);

function renderPanel(panel, key, items) {
  if (!items.length) {
    panel.replaceChildren(el('p', { class: 'end', text: '아직 보여 줄 기사가 없습니다.' }));
    return;
  }
  const ranked = RANKED.has(key);
  panel.replaceChildren(el('div', { class: 'panel' },
    el('div', {}, articleCard(items[0], 'xl')),
    el('div', { class: 'side' }, items.slice(1).map((it, i) => rankRow(it, ranked ? i + 2 : 0)))
  ));
}

export function setupTabs(tablist, panel, lists) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];

  function select(tab, { focus = false } = {}) {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    }
    panel.setAttribute('aria-labelledby', tab.id);
    renderPanel(panel, tab.dataset.tab, lists[tab.dataset.tab] || []);
    if (focus) tab.focus();
  }

  tablist.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) select(tab);
  });

  tablist.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const target = {
      ArrowRight: tabs[(i + 1) % tabs.length],
      ArrowLeft: tabs[(i - 1 + tabs.length) % tabs.length],
      Home: tabs[0],
      End: tabs[tabs.length - 1]
    }[e.key];
    if (!target) return;
    e.preventDefault();
    select(target, { focus: true });
  });

  select(tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0]);
  return { select: (key) => select(tabs.find((t) => t.dataset.tab === key)) };
}
