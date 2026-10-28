// 영역 하나를 독립적으로 불러와 채운다. 실패하면 그 영역에만 안내와 다시 시도 버튼을 보인다(명세 5장).
import { el } from '../lib/dom.js';
import { errorNotice } from './cards.js';

const DEFAULT_ERROR = '이 영역을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도하세요.';

export async function fillSection(host, load, render, { errorMessage = DEFAULT_ERROR } = {}) {
  host.setAttribute('aria-busy', 'true');
  try {
    const data = await load();
    host.replaceChildren();
    render(host, data);
  } catch {
    host.replaceChildren(errorNotice(errorMessage, () => {
      host.replaceChildren(el('p', { class: 'end', text: '불러오는 중' }));
      fillSection(host, load, render, { errorMessage });
    }));
  } finally {
    host.removeAttribute('aria-busy');
  }
}
