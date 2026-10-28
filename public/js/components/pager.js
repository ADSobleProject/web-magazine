// 더보기: 위치값으로 다음 묶음을 받아 기존 목록 아래에 붙인다(명세 3장 C).
// - 요청 중에는 버튼을 잠가 같은 요청이 겹치지 않게 한다.
// - 실패하면 기존 목록은 그대로 두고 다시 시도할 수 있게 한다.
// - 더 받을 것이 없으면 "마지막" 안내로 바꾼다.
import { announce, el } from '../lib/dom.js';
import { errorNotice } from './cards.js';

export function createPager({ grid, footer, cursor, fetchPage, renderItem, endText }) {
  let next = cursor;
  let busy = false;

  function showIdle() {
    if (next) {
      footer.replaceChildren(el('button', { type: 'button', class: 'more', onclick: load, text: '더보기' }));
    } else {
      footer.replaceChildren(el('p', { class: 'end', text: endText }));
    }
  }

  async function load() {
    if (busy || !next) return;
    busy = true;
    footer.replaceChildren(el('button', {
      type: 'button', class: 'more', disabled: true, 'aria-busy': 'true', text: '불러오는 중'
    }));
    try {
      const page = await fetchPage(next);
      const firstNew = grid.children.length;
      grid.append(...page.items.map(renderItem));
      next = page.nextCursor;
      showIdle();
      announce(`기사 ${page.items.length}건을 더 불러왔습니다.`);
      // 키보드 사용자가 새로 붙은 첫 기사부터 이어서 읽을 수 있게 한다.
      grid.children[firstNew]?.focus({ preventScroll: true });
    } catch {
      footer.replaceChildren(errorNotice('기사를 더 불러오지 못했습니다. 잠시 후 다시 시도하세요.', load));
    } finally {
      busy = false;
    }
  }

  showIdle();
  return { load, isBusy: () => busy };
}
