// 목록별 조회 규칙(명세 4-2). 화면과 API는 이 함수들만 쓰므로 DB로 바꿀 때 이 파일만 고치면 된다.
import { encodeCursor, isAfterCursor } from '../lib/cursor.js';

export const LIMITS = {
  latestFirst: 20,
  more: 6,
  tab: 5,
  categoryFeatured: 2,
  videos: 10
};

const HOUR = 60 * 60 * 1000;
const byNewest = (a, b) => b.publishedAt - a.publishedAt || b.id - a.id;

export function categoryUrl(name, sub) {
  return `/category/${encodeURIComponent(name)}` + (sub ? `?sub=${encodeURIComponent(sub)}` : '');
}

export function articleUrl(article) {
  return `/article/${article.id}-${article.slug}`;
}

function toArticle(a) {
  return {
    id: a.id,
    title: a.title,
    deck: a.deck,
    category: a.category,
    categoryUrl: categoryUrl(a.category),
    sub: a.sub,
    views: a.views,
    publishedAt: new Date(a.publishedAt).toISOString(),
    thumbnail: a.thumbnail,
    url: articleUrl(a)
  };
}

function toVideo(v) {
  return { id: v.id, title: v.title, duration: v.duration, thumbnail: v.thumbnail, url: v.url };
}

function toCategory(c) {
  return { name: c.name, url: categoryUrl(c.name), subs: c.subs.slice() };
}

// 최신순 목록에서 위치값 다음부터 limit건. 하나 더 남아 있을 때만 다음 위치값을 준다.
function paginate(sorted, cursor, limit) {
  const start = cursor ? sorted.findIndex((a) => isAfterCursor(a, cursor)) : 0;
  if (start === -1) return { items: [], nextCursor: null };
  const items = sorted.slice(start, start + limit);
  const hasMore = sorted.length > start + limit;
  return {
    items: items.map(toArticle),
    nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null
  };
}

export function createRepository(seed, { now = () => Date.now() } = {}) {
  const { categories, articles, videos, banners } = seed;
  const newest = () => articles.slice().sort(byNewest);

  // 급상승: 짧은 기간에 조회가 몰린 기사. 실제 기준은 서비스에서 정해야 한다(명세 7장).
  const risingScore = (a) => a.views / ((now() - a.publishedAt) / HOUR + 2);

  return {
    categories: () => categories.map(toCategory),
    findCategory: (name) => categories.find((c) => c.name === name) || null,

    findArticle(id) {
      const found = articles.find((a) => a.id === id);
      return found ? { ...toArticle(found), slug: found.slug } : null;
    },

    latest: (cursor) => paginate(newest(), cursor, cursor ? LIMITS.more : LIMITS.latestFirst),

    popular: () => articles.slice()
      .sort((a, b) => b.views - a.views || b.id - a.id)
      .slice(0, LIMITS.tab).map(toArticle),

    // 기획: 편집자가 고정한 기사를 먼저, 나머지는 최신순으로 채운다.
    featured: () => newest()
      .sort((a, b) => Number(b.pinned) - Number(a.pinned))
      .slice(0, LIMITS.tab).map(toArticle),

    rising: () => articles.slice()
      .sort((a, b) => risingScore(b) - risingScore(a) || b.id - a.id)
      .slice(0, LIMITS.tab).map(toArticle),

    // 첫 요청은 대표 2건 + 일반 6건, 이후에는 위치값으로 6건씩.
    categoryArticles(name, { sub = null, cursor = null } = {}) {
      const list = newest().filter((a) => a.category === name && (!sub || a.sub === sub));
      if (cursor) return paginate(list, cursor, LIMITS.more);
      return {
        featured: list.slice(0, LIMITS.categoryFeatured).map(toArticle),
        ...paginate(list.slice(LIMITS.categoryFeatured), null, LIMITS.more)
      };
    },

    videos: () => videos.slice().sort(byNewest).slice(0, LIMITS.videos).map(toVideo),

    banners: (position = 'main-top') => banners
      .filter((b) => b.position === position)
      .sort((a, b) => a.order - b.order)
      .map((b) => ({ id: b.id, image: b.image, alt: b.alt, url: b.url }))
  };
}
