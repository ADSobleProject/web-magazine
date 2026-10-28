// 카테고리 페이지: 대표 2건 + 일반 6건, 이후 더보기(명세 2-2).
import { api } from '../lib/api.js';
import { el } from '../lib/dom.js';
import { articleCard } from '../components/cards.js';
import { createPager } from '../components/pager.js';
import { fillSection } from '../components/section.js';

export function initCategory(root = document) {
  const main = root.querySelector('#main');
  const name = decodeURIComponent(main.dataset.category);
  const sub = main.dataset.sub ? decodeURIComponent(main.dataset.sub) : null;
  const host = root.querySelector('#cat-body');

  return fillSection(host, () => api.categoryArticles(name, { sub }), (target, page) => {
    if (!page.featured.length) {
      target.append(el('div', { class: 'empty' },
        el('p', { text: '이 분류에는 아직 기사가 없습니다.' }),
        sub ? el('a', { class: 'more', href: `/category/${encodeURIComponent(name)}`, text: '전체 보기' }) : null
      ));
      return;
    }
    const grid = el('div', { class: 'grid' }, page.items.map((it) => articleCard(it)));
    const footer = el('div', { class: 'foot' });
    target.append(
      el('div', { class: 'feats' }, el('div', { class: 'grid' }, page.featured.map((it) => articleCard(it, 'lg')))),
      grid,
      footer
    );
    createPager({
      grid,
      footer,
      cursor: page.nextCursor,
      fetchPage: (cursor) => api.categoryArticles(name, { sub, cursor }),
      renderItem: (it) => articleCard(it),
      endText: '이 분류의 마지막 기사까지 모두 확인했습니다.'
    });
  });
}
