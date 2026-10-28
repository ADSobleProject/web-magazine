// 실제 서버가 그린 화면을 가상 브라우저(jsdom)에 띄우고, 화면 코드를 실행해 클릭 동작을 확인한다.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { startServer, waitFor } from './helpers.js';
import { initHome } from '../public/js/pages/home.js';
import { initCategory } from '../public/js/pages/category.js';
import { initThemeToggle } from '../public/js/lib/theme.js';

const realFetch = globalThis.fetch;
let srv;
let calls;
let failWhen; // (url) => true 이면 그 요청을 500으로 실패시킨다.

before(async () => { srv = await startServer(); });
after(async () => { globalThis.fetch = realFetch; await srv.close(); });
beforeEach(() => { calls = []; failWhen = () => false; });

async function openPage(path, server = srv) {
  const html = await (await realFetch(server.base + path)).text();
  const dom = new JSDOM(html, { url: server.base + path });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    sessionStorage: dom.window.sessionStorage
  });
  globalThis.fetch = async (url, opts) => {
    calls.push(String(url));
    if (failWhen(String(url))) return new Response('{}', { status: 500 });
    return realFetch(new URL(url, server.base), opts);
  };
  return dom.window.document;
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const moreButton = (host) => host.querySelector('.foot button.more');

test('메인: 영역별로 따로 요청해 채운다', async () => {
  await openPage('/');
  await initHome();
  assert.deepEqual(calls.sort(), [
    '/api/articles/featured', '/api/articles/latest', '/api/articles/popular',
    '/api/articles/rising', '/api/banners', '/api/videos'
  ]);
  assert.equal($$('#tabpanel .card').length, 1);
  assert.equal($$('#tabpanel .row').length, 4);
  assert.equal($$('#latest .grid > .card').length, 20);
  assert.equal($$('#videos a.vid').length, 10);
  assert.ok($('#banner').hidden, '배너 데이터가 없으면 숨긴다');
  assert.ok(!$('#latest').hasAttribute('aria-busy'));
});

test('탭 전환: 통신 없이 목록만 바뀌고, 키보드로도 옮길 수 있다', async () => {
  await openPage('/');
  await initHome();
  const before = calls.length;
  const firstTitle = () => $('#tabpanel .t.xl').textContent;
  const popularTitle = firstTitle();

  $('#tab-featured').click();
  assert.equal($('#tab-featured').getAttribute('aria-selected'), 'true');
  assert.equal($('#tab-popular').getAttribute('aria-selected'), 'false');
  assert.equal($('#tabpanel').getAttribute('aria-labelledby'), 'tab-featured');
  assert.equal($$('#tabpanel .rank').length, 0, '기획 탭에는 순위 숫자가 없다');
  assert.notEqual(firstTitle(), popularTitle);

  $('#tab-featured').focus();
  $('#tab-featured').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal($('#tab-rising').getAttribute('aria-selected'), 'true');
  assert.equal(document.activeElement, $('#tab-rising'));
  assert.equal($('#tab-rising').tabIndex, 0);
  assert.equal($('#tab-popular').tabIndex, -1);

  assert.equal(calls.length, before, '탭 전환 중 통신이 없어야 한다');
});

test('더보기: 요청 중에는 버튼이 잠기고, 연속으로 눌러도 한 번만 요청한다', async () => {
  await openPage('/');
  await initHome();
  const latest = $('#latest');
  const btn = moreButton(latest);
  const before = calls.length;
  btn.click();
  btn.click();
  const busy = moreButton(latest);
  assert.ok(busy.disabled);
  busy.click();
  await waitFor(() => $$('#latest .grid > .card').length === 26);
  assert.equal(calls.length - before, 1);
  assert.match(calls.at(-1), /^\/api\/articles\/latest\?cursor=/);
  assert.equal(document.activeElement, $$('#latest .grid > .card')[20], '새로 붙은 첫 기사로 초점 이동');
});

test('더보기: 끝까지 넘기면 60건이 중복 없이 보이고 "마지막" 안내로 바뀐다', async () => {
  await openPage('/');
  await initHome();
  const latest = $('#latest');
  while (moreButton(latest)) {
    const count = $$('#latest .grid > .card').length;
    moreButton(latest).click();
    await waitFor(() => $$('#latest .grid > .card').length > count);
  }
  const hrefs = $$('#latest .grid > .card').map((a) => a.getAttribute('href'));
  assert.equal(hrefs.length, 60);
  assert.equal(new Set(hrefs).size, 60);
  assert.match(latest.querySelector('.foot').textContent, /마지막 기사까지/);
});

test('더보기 실패: 기존 목록은 그대로, 다시 시도하면 이어서 불러온다', async () => {
  await openPage('/');
  await initHome();
  failWhen = (url) => url.includes('cursor=');
  moreButton($('#latest')).click();
  await waitFor(() => $('#latest .notice'));
  assert.equal($$('#latest .grid > .card').length, 20);
  assert.equal($('#latest .notice').getAttribute('role'), 'alert');

  failWhen = () => false;
  $('#latest .notice button').click();
  await waitFor(() => $$('#latest .grid > .card').length === 26);
  assert.ok(moreButton($('#latest')));
});

test('한 영역 실패: 그 영역에만 안내가 나오고 나머지는 정상, 다시 시도로 복구', async () => {
  await openPage('/');
  failWhen = (url) => url === '/api/videos';
  await initHome();
  assert.ok($('#videos .notice'));
  assert.equal($$('#latest .grid > .card').length, 20);
  assert.equal($$('#tabpanel .card').length, 1);

  failWhen = () => false;
  $('#videos .notice button').click();
  await waitFor(() => $$('#videos a.vid').length === 10);
});

test('영상: 외부 서비스 링크는 새 창 + noopener, 플레이어는 불러오지 않는다', async () => {
  await openPage('/');
  await initHome();
  const link = $('#videos a.vid');
  assert.equal(link.getAttribute('target'), '_blank');
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  assert.match(link.href, /^https:\/\//);
  assert.equal($$('iframe').length, 0);
});

test('카테고리: 대표 2건 + 일반 6건, 더보기 후 마지막 안내', async () => {
  await openPage('/category/' + encodeURIComponent('패션'));
  await initCategory();
  assert.equal($$('#cat-body .feats .card').length, 2);
  assert.equal($$('#cat-body .feats .t.lg').length, 2);
  assert.equal($$('#cat-body > .grid > .card').length, 6);
  moreButton($('#cat-body')).click();
  await waitFor(() => $$('#cat-body > .grid > .card').length === 8);
  assert.match($('#cat-body .foot').textContent, /이 분류의 마지막 기사까지/);
});

test('카테고리: 세부 분류 필터는 주소에 남고, 기사가 없으면 빈 목록 안내', async () => {
  const other = await startServer({ mutate: (db) => db.query("DELETE FROM articles WHERE sub = '트렌드'") });
  try {
    await openPage('/category/' + encodeURIComponent('패션') + '?sub=' + encodeURIComponent('트렌드'), other);
    assert.equal($('.chip[aria-current="page"]').textContent, '트렌드');
    await initCategory();
    assert.match(calls[0], /sub=%ED%8A%B8%EB%A0%8C%EB%93%9C/);
    assert.match($('#cat-body .empty').textContent, /아직 기사가 없습니다/);
    assert.ok($('#cat-body .empty a.more'));
  } finally {
    await other.close();
  }
});

test('위험한 제목은 글자로만 보이고 실행되지 않는다', async () => {
  const evil = '<img src=x onerror="window.__hacked=1">';
  const other = await startServer({ mutate: (db) => db.query('UPDATE articles SET title = $1', [evil]) });
  try {
    await openPage('/', other);
    await initHome();
    const title = $('#latest .card h3');
    assert.equal(title.textContent, evil);
    assert.equal(title.children.length, 0);
    assert.equal($$('img[src="x"]').length, 0);
    assert.equal(window.__hacked, undefined);
    assert.equal($('#latest .card img').getAttribute('alt'), evil, '대체 텍스트는 기사 제목');
  } finally {
    await other.close();
  }
});

test('다크 모드: 즉시 바뀌고 안내 문구가 반대를 가리키며 쿠키에 저장된다', async () => {
  await openPage('/');
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  const btn = $('#theme-toggle');
  initThemeToggle(btn);
  assert.equal(btn.getAttribute('aria-label'), '어두운 화면으로 바꾸기');
  btn.click();
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(btn.getAttribute('aria-label'), '밝은 화면으로 바꾸기');
  assert.match(document.cookie, /theme=dark/);
  assert.equal(sessionStorage.getItem('theme'), 'dark');
  btn.click();
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
});
