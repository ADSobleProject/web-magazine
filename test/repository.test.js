import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeCursor } from '../src/lib/cursor.js';
import { makeRepo, NOW } from './helpers.js';

// 조회 함수는 API가 해석한 위치값을 받는다.
const dc = (c) => (c ? decodeCursor(c) : undefined);

function readAll(fetchPage) {
  const pages = [];
  let page = fetchPage(undefined);
  pages.push(page);
  while (page.nextCursor) {
    page = fetchPage(dc(page.nextCursor));
    pages.push(page);
  }
  return pages;
}

test('최신 기사: 첫 20건, 이후 6건씩, 60건 모두 한 번씩 최신순', () => {
  const { repo } = makeRepo();
  const pages = readAll((c) => repo.latest(c));
  assert.deepEqual(pages.map((p) => p.items.length), [20, 6, 6, 6, 6, 6, 6, 4]);
  const items = pages.flatMap((p) => p.items);
  assert.equal(new Set(items.map((a) => a.id)).size, 60);
  for (let i = 1; i < items.length; i++) {
    assert.ok(items[i - 1].publishedAt >= items[i].publishedAt);
  }
  assert.equal(pages.at(-1).nextCursor, null);
});

test('최신 기사: 넘겨 보는 도중 새 기사가 올라와도 중복·누락이 없다', () => {
  const { seed, repo } = makeRepo();
  const first = repo.latest();
  seed.articles.push({ ...seed.articles[0], id: 999, slug: 'breaking', publishedAt: NOW + 1000 });
  const rest = readAll((c) => repo.latest(c ?? dc(first.nextCursor))).flatMap((p) => p.items);
  const ids = [...first.items, ...rest].map((a) => a.id);
  assert.equal(ids.length, 60);
  assert.equal(new Set(ids).size, 60);
  assert.ok(!ids.includes(999), '새 기사는 다음 첫 화면에서 보인다');
});

test('같은 시각에 올라온 기사도 번호로 순서를 정해 빠지지 않는다', () => {
  const { seed, repo } = makeRepo();
  for (const a of seed.articles) a.publishedAt = NOW;
  const ids = readAll((c) => repo.latest(c)).flatMap((p) => p.items).map((a) => a.id);
  assert.equal(new Set(ids).size, 60);
});

test('인기·기획·급상승: 각 5건, 기준대로 정렬', () => {
  const { seed, repo } = makeRepo();
  const popular = repo.popular();
  assert.equal(popular.length, 5);
  assert.deepEqual(popular.map((a) => a.views), [...seed.articles].map((a) => a.views).sort((a, b) => b - a).slice(0, 5));

  const pinnedIds = new Set(seed.articles.filter((a) => a.pinned).map((a) => a.id));
  const featured = repo.featured();
  assert.equal(featured.length, 5);
  assert.ok(featured.every((a) => pinnedIds.has(a.id)), '고정 기사가 먼저 나온다');

  assert.equal(repo.rising().length, 5);
});

test('카테고리: 대표 2건 + 일반 6건, 더보기로 나머지', () => {
  const { repo } = makeRepo();
  const first = repo.categoryArticles('패션');
  assert.equal(first.featured.length, 2);
  assert.equal(first.items.length, 6);
  assert.ok(first.nextCursor);
  const second = repo.categoryArticles('패션', { cursor: dc(first.nextCursor) });
  assert.equal(second.items.length, 2);
  assert.equal(second.nextCursor, null);
  const all = [...first.featured, ...first.items, ...second.items];
  assert.equal(new Set(all.map((a) => a.id)).size, 10);
  assert.ok(all.every((a) => a.category === '패션'));
});

test('카테고리: 세부 분류로 좁히기, 기사가 없으면 빈 목록', () => {
  const { seed, repo } = makeRepo((s) => {
    s.articles = s.articles.filter((a) => a.sub !== '트렌드');
  });
  const style = repo.categoryArticles('패션', { sub: '스타일' });
  assert.ok([...style.featured, ...style.items].every((a) => a.sub === '스타일'));
  const empty = repo.categoryArticles('패션', { sub: '트렌드' });
  assert.deepEqual(empty, { featured: [], items: [], nextCursor: null });
  assert.ok(seed.articles.length < 60);
});

test('기사 주소는 번호-영문요약 형식', () => {
  const { repo } = makeRepo();
  assert.equal(repo.findArticle(100).url, '/article/100-oversized-coat-shoulder-line');
  assert.equal(repo.findArticle(1), null);
});

test('영상 10건, 배너는 비어 있음', () => {
  const { repo } = makeRepo();
  assert.equal(repo.videos().length, 10);
  assert.deepEqual(repo.banners(), []);
});
