// 공개 화면용 조회 규칙(명세 4-2). 화면과 API는 이 함수들만 쓴다.
// 공개 조건: 게시됨(status = 'published')이고 게시 시각이 지금 이전. 임시저장·예약 기사는 보이지 않는다.
import { encodeCursor } from '../lib/cursor.js';
import { CATEGORIES, findCategory } from './categories.js';

export const LIMITS = {
  latestFirst: 20,
  more: 6,
  tab: 5,
  categoryFeatured: 2,
  videos: 10,
  related: 4
};

const COLUMNS = 'id, slug, title, deck, category, sub, thumbnail, views, published_at';
const PUBLIC = "status = 'published' AND published_at <= $1";

export function categoryUrl(name, sub) {
  return `/category/${encodeURIComponent(name)}` + (sub ? `?sub=${encodeURIComponent(sub)}` : '');
}

export function articleUrl(article) {
  return `/article/${article.id}-${article.slug}`;
}

function toArticle(row) {
  return {
    id: row.id,
    title: row.title,
    deck: row.deck,
    category: row.category,
    categoryUrl: categoryUrl(row.category),
    sub: row.sub,
    views: row.views,
    publishedAt: row.published_at.toISOString(),
    thumbnail: row.thumbnail || null,
    url: articleUrl(row)
  };
}

function toCategory(c) {
  return { name: c.name, url: categoryUrl(c.name), subs: c.subs.slice() };
}

export function createRepository(db, { now = () => new Date() } = {}) {
  // 위치값 다음부터 limit건. 하나 더 읽어서 다음 묶음이 있는지 판단한다.
  async function page(where, params, cursor, limit) {
    const values = [now(), ...params];
    let sql = `SELECT ${COLUMNS} FROM articles WHERE ${PUBLIC}${where}`;
    if (cursor) {
      values.push(new Date(cursor.publishedAt), cursor.id);
      sql += ` AND (published_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::int)`;
    }
    values.push(limit + 1);
    sql += ` ORDER BY published_at DESC, id DESC LIMIT $${values.length}`;
    const { rows } = await db.query(sql, values);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return {
      items: items.map(toArticle),
      nextCursor: rows.length > limit ? encodeCursor({ publishedAt: last.published_at.getTime(), id: last.id }) : null
    };
  }

  async function list(orderBy, limit) {
    const { rows } = await db.query(
      `SELECT ${COLUMNS} FROM articles WHERE ${PUBLIC} ORDER BY ${orderBy} LIMIT $2`, [now(), limit]);
    return rows.map(toArticle);
  }

  return {
    categories: () => CATEGORIES.map(toCategory),
    findCategory,

    latest: (cursor) => page('', [], cursor, cursor ? LIMITS.more : LIMITS.latestFirst),

    popular: () => list('views DESC, id DESC', LIMITS.tab),

    // 기획: 편집자가 고정한 기사를 먼저, 나머지는 최신순으로 채운다.
    featured: () => list('pinned DESC, published_at DESC, id DESC', LIMITS.tab),

    // 급상승: 게시 후 시간 대비 조회가 많은 기사. 실제 기준은 서비스에서 정해야 한다(명세 7장).
    rising: () => list('views / (EXTRACT(EPOCH FROM ($1 - published_at)) / 3600 + 2) DESC, id DESC', LIMITS.tab),

    // 첫 요청은 대표 2건 + 일반 6건, 이후에는 위치값으로 6건씩.
    async categoryArticles(name, { sub = null, cursor = null } = {}) {
      const where = sub ? ' AND category = $2 AND sub = $3' : ' AND category = $2';
      const params = sub ? [name, sub] : [name];
      if (cursor) return page(where, params, cursor, LIMITS.more);
      const first = await page(where, params, null, LIMITS.categoryFeatured + LIMITS.more);
      return {
        featured: first.items.slice(0, LIMITS.categoryFeatured),
        items: first.items.slice(LIMITS.categoryFeatured),
        nextCursor: first.nextCursor
      };
    },

    // 공개된 기사 하나. 본문 포함.
    async findArticle(id) {
      const { rows } = await db.query(
        `SELECT ${COLUMNS}, body_html, updated_at FROM articles WHERE ${PUBLIC} AND id = $2`, [now(), id]);
      if (!rows[0]) return null;
      return { ...toArticle(rows[0]), slug: rows[0].slug, bodyHtml: rows[0].body_html, updatedAt: rows[0].updated_at.toISOString() };
    },

    async related(article) {
      const { rows } = await db.query(
        `SELECT ${COLUMNS} FROM articles WHERE ${PUBLIC} AND category = $2 AND id <> $3
         ORDER BY published_at DESC, id DESC LIMIT $4`,
        [now(), article.category, article.id, LIMITS.related]);
      return rows.map(toArticle);
    },

    async addView(id) {
      await db.query('UPDATE articles SET views = views + 1 WHERE id = $1', [id]);
    },

    async videos() {
      const { rows } = await db.query(
        'SELECT id, title, duration, thumbnail, url FROM videos ORDER BY published_at DESC, id DESC LIMIT $1', [LIMITS.videos]);
      return rows;
    },

    async banners(position = 'main-top') {
      const { rows } = await db.query(
        'SELECT id, image, alt, url FROM banners WHERE position = $1 ORDER BY sort, id', [position]);
      return rows;
    }
  };
}
