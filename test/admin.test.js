// 관리자 화면: 첫 관리자 설정, 로그인, 권한, CSRF, 기사 작성·게시·삭제, 업로드
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, NOW } from './helpers.js';
import { createUsers } from '../src/auth/users.js';

const TOKEN = 'setup-token-for-tests-123456';
const ADMIN = { email: 'admin@example.com', name: '관리자', password: 'admin-password-1' };
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'), Buffer.alloc(32)]);

let srv;
let cookie = '';
let csrf = '';

before(async () => { srv = await startServer({ setupToken: TOKEN }); });
after(() => srv.close());

// 같은 사이트의 폼에서 보낸 것처럼 Origin을 붙인다.
function post(path, fields, { headers = {}, jar = cookie } = {}) {
  return fetch(srv.base + path, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: srv.base, cookie: jar, ...headers },
    body: new URLSearchParams(fields)
  });
}
const get = (path, jar = cookie) => fetch(srv.base + path, { redirect: 'manual', headers: { cookie: jar } });
const sessionCookie = (res) => (res.headers.get('set-cookie') || '').split(';')[0];

async function readCsrf(jar = cookie) {
  const html = await (await get('/admin', jar)).text();
  return html.match(/<meta name="csrf-token" content="([^"]+)">/)[1];
}

async function login(email, password) {
  const res = await post('/admin/login', { email, password }, { jar: '' });
  return { res, jar: sessionCookie(res) };
}

const articleFields = (over = {}) => ({
  _csrf: csrf, title: '새 기사', deck: '보조 문장', category: '테크', sub: '기기', slug: 'new-article',
  body_html: '<p>본문입니다</p>', published_at: '', action: 'publish', ...over
});

test('로그인 없이 관리자 화면에 들어갈 수 없다', async () => {
  assert.equal((await get('/admin', '')).headers.get('location'), '/admin/login');
  assert.equal((await get('/admin/articles/new', '')).status, 303);
  assert.equal((await get('/admin/export', '')).status, 303);
  const upload = await fetch(srv.base + '/admin/api/uploads', { method: 'POST' });
  assert.equal(upload.status, 401);
});

test('첫 관리자 설정: 설정 코드가 틀리거나 다른 사이트에서 보내면 거절', async () => {
  assert.equal((await get('/admin/setup', '')).status, 200);
  const wrong = await post('/admin/setup', { token: 'wrong-token-xxxxxxxxxxxx', ...ADMIN, password2: ADMIN.password }, { jar: '' });
  assert.equal(wrong.status, 400);
  assert.match(await wrong.text(), /설정 코드가 맞지 않습니다/);
  const cross = await post('/admin/setup', { token: TOKEN, ...ADMIN, password2: ADMIN.password },
    { jar: '', headers: { origin: 'https://evil.example' } });
  assert.equal(cross.status, 403);
  const weak = await post('/admin/setup', { token: TOKEN, ...ADMIN, password: 'short', password2: 'short' }, { jar: '' });
  assert.equal(weak.status, 400);
});

test('첫 관리자 설정: 성공하면 로그인되고, 이후에는 설정 화면이 닫힌다', async () => {
  const res = await post('/admin/setup', { token: TOKEN, ...ADMIN, password2: ADMIN.password }, { jar: '' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/admin');
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//);
  cookie = sessionCookie(res);
  csrf = await readCsrf();

  assert.equal((await get('/admin/setup', '')).status, 303, '두 번째부터는 열리지 않음');
  const again = await post('/admin/setup', { token: TOKEN, email: 'x@example.com', name: 'x', password: ADMIN.password, password2: ADMIN.password }, { jar: '' });
  assert.equal(again.status, 303);
  assert.equal(again.headers.get('location'), '/admin/login');
  const { rows } = await srv.db.query('SELECT email, password_hash FROM users');
  assert.equal(rows.length, 1);
  assert.ok(!rows[0].password_hash.includes(ADMIN.password), '비밀번호 원문은 저장하지 않음');
});

test('로그인: 틀리면 401, 다른 사이트에서 보낸 로그인은 403', async () => {
  assert.equal((await login(ADMIN.email, 'wrong-password')).res.status, 401);
  assert.equal((await login('nobody@example.com', 'wrong-password')).res.status, 401);
  const cross = await post('/admin/login', ADMIN, { jar: '', headers: { origin: 'https://evil.example' } });
  assert.equal(cross.status, 403);
  const ok = await login(` ${ADMIN.email.toUpperCase()} `, ADMIN.password);
  assert.equal(ok.res.status, 303, '이메일 대소문자·공백은 무시');
});

test('CSRF: 토큰이 없거나 틀리거나 다른 사이트에서 온 요청은 거절', async () => {
  const before = (await srv.db.query('SELECT count(*)::int AS n FROM articles')).rows[0].n;
  assert.equal((await post('/admin/articles', articleFields({ _csrf: '' }))).status, 403);
  assert.equal((await post('/admin/articles', articleFields({ _csrf: 'x'.repeat(43) }))).status, 403);
  assert.equal((await post('/admin/articles', articleFields(), { headers: { origin: 'https://evil.example' } })).status, 403);
  const upload = await fetch(srv.base + '/admin/api/uploads', { method: 'POST', headers: { cookie } });
  assert.equal(upload.status, 403);
  assert.equal((await srv.db.query('SELECT count(*)::int AS n FROM articles')).rows[0].n, before);
});

test('기사 쓰기: 게시하면 공개 목록 맨 앞과 상세 화면에 나온다', async () => {
  const res = await post('/admin/articles', articleFields());
  assert.equal(res.status, 303);
  const id = Number(res.headers.get('location').match(/\/admin\/articles\/(\d+)/)[1]);

  const latest = await (await get('/api/articles/latest', '')).json();
  assert.equal(latest.items[0].id, id);
  const page = await get(`/article/${id}-new-article`, '');
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<h1>새 기사<\/h1>/);
  assert.match(html, /<div class="article-body"><p>본문입니다<\/p><\/div>/);
  assert.match(html, /"@type":"Article"/);
});

test('기사 쓰기: 본문의 위험한 코드는 저장 전에 지워진다', async () => {
  const res = await post('/admin/articles', articleFields({
    slug: 'xss-test',
    body_html: '<p>안전<img src=x onerror=alert(1)><script>alert(2)</script><a href="javascript:alert(3)">링크</a></p>'
  }));
  const id = Number(res.headers.get('location').match(/(\d+)/)[1]);
  const { rows } = await srv.db.query('SELECT body_html FROM articles WHERE id = $1', [id]);
  assert.equal(rows[0].body_html, '<p>안전<a>링크</a></p>');
});

test('임시저장·예약 기사는 공개되지 않고, 관리자 미리보기로만 보인다', async () => {
  const draft = await post('/admin/articles', articleFields({ slug: 'draft-article', action: 'draft' }));
  const draftId = Number(draft.headers.get('location').match(/(\d+)/)[1]);
  assert.equal((await get(`/article/${draftId}-draft-article`, '')).status, 404);

  const future = new Date(NOW + 24 * 3600 * 1000 + 9 * 3600 * 1000).toISOString().slice(0, 16);
  const scheduled = await post('/admin/articles', articleFields({ slug: 'scheduled-article', published_at: future }));
  const scheduledId = Number(scheduled.headers.get('location').match(/(\d+)/)[1]);
  assert.equal((await get(`/article/${scheduledId}-scheduled-article`, '')).status, 404);
  const ids = (await (await get('/api/articles/latest', '')).json()).items.map((a) => a.id);
  assert.ok(!ids.includes(draftId) && !ids.includes(scheduledId));

  const preview = await get(`/admin/articles/${draftId}/preview`);
  assert.equal(preview.status, 200);
  const html = await preview.text();
  assert.match(html, /미리보기 화면입니다. 방문자에게는 아직 보이지 않습니다/);
  assert.match(html, /noindex/);

  const list = await (await get('/admin?status=scheduled')).text();
  assert.match(list, /예약/);
  assert.match(list, /새 기사/);
});

test('입력 오류는 400과 함께 칸별 안내, 입력값은 이스케이프되어 다시 채워진다', async () => {
  const res = await post('/admin/articles', articleFields({ title: '', slug: 'Bad Slug', deck: '"><script>alert(1)</script>' }));
  assert.equal(res.status, 400);
  const html = await res.text();
  assert.match(html, /제목을 입력하세요/);
  assert.match(html, /영문 소문자, 숫자, 하이픈/);
  assert.ok(!html.includes('"><script>alert(1)'));
  assert.match(html, /&quot;&gt;&lt;script&gt;/);
});

test('기사 수정과 삭제', async () => {
  const res = await post('/admin/articles', articleFields({ slug: 'to-edit' }));
  const id = Number(res.headers.get('location').match(/(\d+)/)[1]);
  const edited = await post(`/admin/articles/${id}`, articleFields({ title: '고친 제목', slug: 'edited' }));
  assert.equal(edited.status, 303);
  assert.equal((await get(`/article/${id}-to-edit`, '')).headers.get('location'), `/article/${id}-edited`);
  assert.match(await (await get(`/article/${id}-edited`, '')).text(), /고친 제목/);

  assert.equal((await post(`/admin/articles/${id}/delete`, { _csrf: csrf })).status, 303);
  assert.equal((await get(`/article/${id}-edited`, '')).status, 404);
  assert.equal((await get(`/admin/articles/${id}`)).status, 404);
});

test('이미지 업로드: PNG는 저장되고, SVG·HTML과 5MB 초과는 거절', async () => {
  const send = (buffer, name, type) => {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type }), name);
    return fetch(srv.base + '/admin/api/uploads', { method: 'POST', body: form, headers: { cookie, 'x-csrf-token': csrf } });
  };
  const ok = await send(PNG, 'a.png', 'image/png');
  assert.equal(ok.status, 201);
  const { url } = await ok.json();
  assert.match(url, /^\/uploads\/[0-9a-f]{32}\.png$/);
  const file = await get(url, '');
  assert.equal(file.status, 200);
  assert.match(file.headers.get('content-type'), /image\/png/);

  assert.equal((await send(Buffer.from('<svg><script>alert(1)</script></svg>'), 'a.png', 'image/png')).status, 415);
  assert.equal((await send(Buffer.from('<html>hi</html>'), 'a.jpg', 'image/jpeg')).status, 415);
  assert.equal((await send(Buffer.alloc(5 * 1024 * 1024 + 1), 'big.png', 'image/png')).status, 413);
});

test('백업 내려받기와 샘플 기사 일괄 삭제', async () => {
  const backup = await get('/admin/export');
  assert.match(backup.headers.get('content-disposition'), /attachment; filename="articles-\d{4}-\d{2}-\d{2}\.json"/);
  const data = await backup.json();
  assert.ok(data.articles.length > 60);

  assert.equal((await post('/admin/samples/delete', { _csrf: csrf })).status, 303);
  const { rows } = await srv.db.query('SELECT count(*)::int AS n, count(*) FILTER (WHERE is_sample)::int AS s FROM articles');
  assert.equal(rows[0].s, 0);
  assert.ok(rows[0].n > 0, '직접 쓴 기사는 남는다');
});

test('역할: editor는 백업·샘플 삭제를 할 수 없다', async () => {
  await createUsers(srv.db).create({ email: 'editor@example.com', name: '기자', password: 'editor-password-1', role: 'editor' });
  const { jar } = await login('editor@example.com', 'editor-password-1');
  assert.equal((await get('/admin', jar)).status, 200);
  assert.equal((await get('/admin/export', jar)).status, 403);
});

test('로그아웃하면 그 세션은 더 이상 쓸 수 없다', async () => {
  const { jar } = await login(ADMIN.email, ADMIN.password);
  const token = await readCsrf(jar);
  assert.equal((await post('/admin/logout', { _csrf: token }, { jar })).status, 303);
  assert.equal((await get('/admin', jar)).status, 303);
});

test('로그인 제한: 5번 틀리면 맞는 비밀번호도 잠시 막힌다', async () => {
  for (let i = 0; i < 5; i++) await login(ADMIN.email, 'wrong-password');
  const blocked = await login(ADMIN.email, ADMIN.password);
  assert.equal(blocked.res.status, 429);
  assert.match(await blocked.res.text(), /로그인 시도가 너무 많습니다/);
});

test('관리자 화면은 캐시·검색 노출 금지', async () => {
  const res = await get('/admin');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(res.headers.get('x-robots-tag'), /noindex/);
});
