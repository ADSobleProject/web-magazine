// 메인 페이지: 영역별 데이터를 동시에 요청하고, 응답이 오는 영역부터 채운다(명세 3장 A).
import { api } from '../lib/api.js';
import { el } from '../lib/dom.js';
import { safeImageUrl, safeUrl } from '../lib/format.js';
import { articleCard, videoCard } from '../components/cards.js';
import { createPager } from '../components/pager.js';
import { fillSection } from '../components/section.js';
import { setupTabs } from '../components/tabs.js';

export function initHome(root = document) {
  const tablist = root.querySelector('[role="tablist"]');
  const panel = root.querySelector('#tabpanel');

  const tabs = fillSection(panel,
    async () => {
      const [popular, featured, rising] = await Promise.all([api.popular(), api.featured(), api.rising()]);
      return { popular: popular.items, featured: featured.items, rising: rising.items };
    },
    (host, lists) => setupTabs(tablist, host, lists)
  );

  const latest = fillSection(root.querySelector('#latest'), () => api.latest(), (host, page) => {
    const grid = el('div', { class: 'grid' }, page.items.map((it) => articleCard(it)));
    const footer = el('div', { class: 'foot' });
    host.append(grid, footer);
    createPager({
      grid,
      footer,
      cursor: page.nextCursor,
      fetchPage: (cursor) => api.latest(cursor),
      renderItem: (it) => articleCard(it),
      endText: '마지막 기사까지 모두 확인했습니다.'
    });
  });

  const videos = fillSection(root.querySelector('#videos'), () => api.videos(), (host, data) => {
    host.append(el('div', { class: 'vids' }, data.items.map(videoCard)));
  });

  // 배너는 부가 영역이라 실패하거나 비어 있으면 아무것도 보이지 않는다.
  const bannerHost = root.querySelector('#banner');
  const banners = api.banners().then((data) => {
    const items = data.items
      .map((b) => ({ ...b, href: safeUrl(b.url, { allowExternal: true }), src: safeImageUrl(b.image) }))
      .filter((b) => b.href && b.src);
    if (!items.length) return;
    bannerHost.replaceChildren(...items.map((b) =>
      el('a', { href: b.href }, el('img', { src: b.src, alt: b.alt || '', loading: 'lazy' }))));
    bannerHost.hidden = false;
  }).catch(() => {});

  return Promise.all([tabs, latest, videos, banners]);
}
