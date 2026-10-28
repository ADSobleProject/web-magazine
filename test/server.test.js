import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startServer } from './helpers.js';

let srv;
before(async () => { srv = await startServer(); });
after(() => srv.close());

const get = (path, headers = {}) => fetch(srv.base + path, { redirect: 'manual', headers });
const FASHION = '/category/' + encodeURIComponent('패션');

// fetch는 주소를 정리해 버리므로, 이상한 경로는 그대로 보내 확인한다.
function rawGet(base, path) {
  const { port } = new URL(base);
  return new Promise((resolve, reject) => {
    http.get({ port, path }, (res) => { res.resume(); resolve(res); }).on('error', reject);
  });
}

test('메인: 틀(헤더, 카테고리 메뉴 6개, 푸터)과 자리 표시를 먼저 그린다', async () => {
  const res = await get('/');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<title>브랜드명<\/title>/);
  assert.equal((html.match(/href="\/category\//g) || []).length, 6);
  assert.match(html, /role="tablist"/);
  assert.match(html, /<footer class="site-foot">/);
  assert.match(html, /application\/ld\+json/);
});

test('보안 헤더가 붙는다', async () => {
  const res = await get('/');
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('테마: 쿠키에 맞춰 첫 화면부터 테마를 정하고, 이상한 값은 무시한다', async () => {
  assert.match(await (await get('/', { cookie: 'theme=dark' })).text(), /<html lang="ko" data-theme="dark">/);
  const bad = await (await get('/', { cookie: 'theme="><script>alert(1)</script>' })).text();
  assert.match(bad, /<html lang="ko">/);
  assert.ok(!bad.includes('alert(1)'));
});

test('카테고리: 탭 제목은 "카테고리 | 사이트", 메뉴에 현재 위치 표시', async () => {
  const html = await (await get(FASHION)).text();
  assert.match(html, /<title>패션 \| 브랜드명<\/title>/);
  assert.match(html, /<a href="\/category\/%ED%8C%A8%EC%85%98" aria-current="page">패션<\/a>/);
  assert.match(html, /<h1>패션<\/h1>/);
});

test('카테고리: 없는 분류는 404 안내, 없는 세부 분류는 전체 보기로 이동', async () => {
  const missing = await get('/category/' + encodeURIComponent('없는분류'));
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /메인으로 이동/);
  const badSub = await get(FASHION + '?sub=nope');
  assert.equal(badSub.status, 302);
  assert.equal(badSub.headers.get('location'), FASHION);
});

test('기사: 번호만으로 찾고 정식 주소로 이동, 없는 기사는 404', async () => {
  for (const p of ['/article/100', '/article/100-wrong-slug']) {
    const res = await get(p);
    assert.equal(res.status, 301);
    assert.equal(res.headers.get('location'), '/article/100-oversized-coat-shoulder-line');
  }
  assert.equal((await get('/article/100-oversized-coat-shoulder-line')).status, 200);
  assert.equal((await get('/article/1')).status, 404);
  assert.equal((await get('/article/abc')).status, 404);
});

test('정식 주소: 끝의 / 정리, 외부 사이트로 이동시키지 않는다', async () => {
  const trailing = await get('/info/about/');
  assert.equal(trailing.status, 301);
  assert.equal(trailing.headers.get('location'), '/info/about');

  for (const path of ['//evil.com/', '//evil.com', '/\\evil.com/', '///evil.com/x']) {
    const res = await rawGet(srv.base, path);
    if (res.statusCode === 301) {
      const loc = res.headers.location;
      assert.ok(loc.startsWith('/') && !loc.startsWith('//') && !loc.startsWith('/\\'), `${path} → ${loc}`);
    } else {
      assert.notEqual(res.statusCode, 302);
    }
  }
});

test('정식 주소: 다른 호스트로 들어오면 정식 호스트로 301', async () => {
  const other = await startServer({ siteOrigin: 'https://www.example.com' });
  try {
    const res = await fetch(other.base + FASHION + '?sub=x', { redirect: 'manual' });
    assert.equal(res.status, 301);
    assert.equal(res.headers.get('location'), `https://www.example.com${FASHION}?sub=x`);
  } finally {
    await other.close();
  }
});

test('API 최신 기사: 첫 20건, 위치값으로 6건씩', async () => {
  const first = await (await get('/api/articles/latest')).json();
  assert.equal(first.items.length, 20);
  const second = await (await get('/api/articles/latest?cursor=' + first.nextCursor)).json();
  assert.equal(second.items.length, 6);
  assert.ok(!second.items.some((a) => first.items.some((b) => b.id === a.id)));
});

test('API: 잘못된 입력은 400/404', async () => {
  assert.equal((await get('/api/articles/latest?cursor=zzz')).status, 400);
  assert.equal((await get('/api/articles/latest?cursor=a&cursor=b')).status, 400);
  assert.equal((await get('/api/categories/' + encodeURIComponent('없음') + '/articles')).status, 404);
  assert.equal((await get(`/api${FASHION.replace('/category', '/categories')}/articles?sub=nope`)).status, 400);
  const unknown = await get('/api/nothing');
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { error: 'not_found' });
});

test('API: 탭 3종 5건씩, 영상 10건, 카테고리 6개, 배너 0건', async () => {
  for (const k of ['popular', 'featured', 'rising']) {
    assert.equal((await (await get(`/api/articles/${k}`)).json()).items.length, 5);
  }
  assert.equal((await (await get('/api/videos')).json()).items.length, 10);
  assert.equal((await (await get('/api/categories')).json()).items.length, 6);
  assert.deepEqual((await (await get('/api/banners')).json()).items, []);
});

test('썸네일: 번호별 SVG, 잘못된 주소는 404', async () => {
  const res = await get('/img/thumb/7.svg');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /image\/svg\+xml/);
  assert.equal((await get('/img/thumb/abc.svg')).status, 404);
});

test('위험한 제목이 들어와도 서버 화면에서 실행되지 않는다', async () => {
  const evil = '<script>alert(1)</script>"><img src=x onerror=alert(2)>';
  const other = await startServer({ mutate: (db) => db.query('UPDATE articles SET title = $1 WHERE id = 100', [evil]) });
  try {
    const html = await (await fetch(other.base + '/article/100-oversized-coat-shoulder-line')).text();
    assert.ok(!html.includes('<script>alert(1)'));
    assert.ok(!html.includes('<img src=x'));
    assert.match(html, /&lt;script&gt;alert\(1\)/);
    assert.match(html, /\\u003cscript>alert\(1\)/);
  } finally {
    await other.close();
  }
});
