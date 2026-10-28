import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { dc, makeDb, makeRepo, NOW } from './helpers.js';

let db;
before(async () => { db = await makeDb(); });
after(() => db.close());

async function readAll(fetchPage) {
  const pages = [];
  let page = await fetchPage(undefined);
  pages.push(page);
  while (page.nextCursor) {
    page = await fetchPage(dc(page.nextCursor));
    pages.push(page);
  }
  return pages;
}

// 데이터를 바꾸는 테스트는 트랜잭션 안에서 하고 되돌려, 다른 테스트에 영향을 주지 않는다.
async function inRollback(fn) {
  await db.exec('BEGIN');
  try {
    await fn();
  } finally {
    await db.exec('ROLLBACK');
  }
}

test('최신 기사: 첫 20건, 이후 6건씩, 60건 모두 한 번씩 최신순', async () => {
  const repo = makeRepo(db);
  const pages = await readAll((c) => repo.latest(c));
  assert.deepEqual(pages.map((p) => p.items.length), [20, 6, 6, 6, 6, 6, 6, 4]);
  const items = pages.flatMap((p) => p.items);
  assert.equal(new Set(items.map((a) => a.id)).size, 60);
  for (let i = 1; i < items.length; i++) {
    assert.ok(items[i - 1].publishedAt >= items[i].publishedAt);
  }
  assert.equal(pages.at(-1).nextCursor, null);
});

test('최신 기사: 넘겨 보는 도중 새 기사가 올라와도 중복·누락이 없다', () => inRollback(async () => {
  const repo = makeRepo(db, NOW + 60000);
  const first = await repo.latest();
  await db.query(
    `INSERT INTO articles (slug, title, category, status, published_at) VALUES ('breaking', '속보', '패션', 'published', $1)`,
    [new Date(NOW + 1000)]);
  let cursor = dc(first.nextCursor);
  const ids = first.items.map((a) => a.id);
  while (cursor) {
    const page = await repo.latest(cursor);
    ids.push(...page.items.map((a) => a.id));
    cursor = dc(page.nextCursor);
  }
  assert.equal(ids.length, 60);
  assert.equal(new Set(ids).size, 60);
  assert.equal((await repo.latest()).items[0].title, '속보', '새 기사는 다음 첫 화면에서 보인다');
}));

test('같은 시각에 올라온 기사도 번호로 순서를 정해 빠지지 않는다', () => inRollback(async () => {
  await db.query('UPDATE articles SET published_at = $1', [new Date(NOW - 1000)]);
  const repo = makeRepo(db);
  const ids = (await readAll((c) => repo.latest(c))).flatMap((p) => p.items).map((a) => a.id);
  assert.equal(new Set(ids).size, 60);
}));

test('임시저장·예약 기사는 공개 목록과 상세에 나오지 않는다', () => inRollback(async () => {
  const { rows } = await db.query(
    `INSERT INTO articles (slug, title, category, status, published_at) VALUES
       ('draft-one', '임시', '패션', 'draft', NULL),
       ('future-one', '예약', '패션', 'published', $1)
     RETURNING id`, [new Date(NOW + 3600 * 1000)]);
  const repo = makeRepo(db);
  const all = (await readAll((c) => repo.latest(c))).flatMap((p) => p.items);
  assert.equal(all.length, 60);
  for (const { id } of rows) assert.equal(await repo.findArticle(id), null);
  assert.ok(await makeRepo(db, NOW + 2 * 3600 * 1000).findArticle(rows[1].id), '예약 시각이 지나면 보인다');
}));

test('인기·기획·급상승: 각 5건, 기준대로 정렬', async () => {
  const repo = makeRepo(db);
  const popular = await repo.popular();
  assert.equal(popular.length, 5);
  const { rows } = await db.query('SELECT views FROM articles ORDER BY views DESC LIMIT 5');
  assert.deepEqual(popular.map((a) => a.views), rows.map((r) => r.views));

  const pinned = new Set((await db.query('SELECT id FROM articles WHERE pinned')).rows.map((r) => r.id));
  const featured = await repo.featured();
  assert.equal(featured.length, 5);
  assert.ok(featured.every((a) => pinned.has(a.id)), '고정 기사가 먼저 나온다');

  assert.equal((await repo.rising()).length, 5);
});

test('카테고리: 대표 2건 + 일반 6건, 더보기로 나머지', async () => {
  const repo = makeRepo(db);
  const first = await repo.categoryArticles('패션');
  assert.equal(first.featured.length, 2);
  assert.equal(first.items.length, 6);
  assert.ok(first.nextCursor);
  const second = await repo.categoryArticles('패션', { cursor: dc(first.nextCursor) });
  assert.equal(second.items.length, 2);
  assert.equal(second.nextCursor, null);
  const all = [...first.featured, ...first.items, ...second.items];
  assert.equal(new Set(all.map((a) => a.id)).size, 10);
  assert.ok(all.every((a) => a.category === '패션'));
});

test('카테고리: 세부 분류로 좁히기, 기사가 없으면 빈 목록', () => inRollback(async () => {
  await db.query("DELETE FROM articles WHERE sub = '트렌드'");
  const repo = makeRepo(db);
  const style = await repo.categoryArticles('패션', { sub: '스타일' });
  assert.ok([...style.featured, ...style.items].every((a) => a.sub === '스타일'));
  assert.deepEqual(await repo.categoryArticles('패션', { sub: '트렌드' }), { featured: [], items: [], nextCursor: null });
}));

test('기사 상세: 번호-영문요약 주소, 본문, 같은 분류 최신 기사 4건', async () => {
  const repo = makeRepo(db);
  const article = await repo.findArticle(100);
  assert.equal(article.url, '/article/100-oversized-coat-shoulder-line');
  assert.match(article.bodyHtml, /샘플/);
  const related = await repo.related(article);
  assert.equal(related.length, 4);
  assert.ok(related.every((a) => a.category === article.category && a.id !== 100));
  assert.equal(await repo.findArticle(1), null);
});

test('조회수가 1씩 오른다', () => inRollback(async () => {
  const repo = makeRepo(db);
  const before = (await repo.findArticle(100)).views;
  await repo.addView(100);
  assert.equal((await repo.findArticle(100)).views, before + 1);
}));

test('영상 10건, 배너는 비어 있음', async () => {
  const repo = makeRepo(db);
  assert.equal((await repo.videos()).length, 10);
  assert.deepEqual(await repo.banners(), []);
});

test('샘플은 한 번만 들어간다(서버를 다시 켜도 중복되지 않음)', async () => {
  const { migrate } = await import('../src/db/migrations.js');
  await migrate(db, { now: NOW });
  assert.equal((await db.query('SELECT count(*)::int AS n FROM articles')).rows[0].n, 60);
});
