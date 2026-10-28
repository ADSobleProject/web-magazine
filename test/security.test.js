// 본문 정리, 비밀번호, 이미지 판별, 입력 검사처럼 보안과 직결된 작은 부품들
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedImage, sanitizeBody } from '../src/lib/sanitize.js';
import { checkPasswordRule, hashPassword, verifyPassword } from '../src/auth/password.js';
import { createImageStore, detectImage, StorageUnavailableError } from '../src/lib/images.js';
import { parseKst, readArticleForm, toKstInput } from '../src/admin/articleForm.js';
import { createLoginLimiter } from '../src/auth/rateLimit.js';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

test('본문 정리: 스크립트와 이벤트 속성, 위험한 주소를 지운다', () => {
  const dirty = [
    '<p onclick="alert(1)">안녕<script>alert(2)</script></p>',
    '<a href="javascript:alert(3)">링크</a>',
    '<img src=x onerror=alert(4)>',
    '<img src="https://evil.example/a.png">',
    '<img src="data:image/png;base64,AAAA">',
    '<iframe src="https://evil.example"></iframe>',
    '<p style="position:fixed">스타일</p>',
    '<svg><script>alert(5)</script></svg>',
    '<p class="ql-align-center evil">가운데</p>'
  ].join('');
  const clean = sanitizeBody(dirty);
  for (const bad of ['script', 'onclick', 'onerror', 'javascript:', 'evil.example', 'data:', 'iframe', 'style=', 'svg', 'evil"']) {
    assert.ok(!clean.includes(bad), `${bad} 가 남아 있음: ${clean}`);
  }
  assert.match(clean, /<p>안녕<\/p>/);
  assert.match(clean, /<p class="ql-align-center">가운데<\/p>/);
});

test('본문 정리: 허용한 서식과 이미지는 남기고, 외부 링크는 새 창 + noopener', () => {
  const html = '<h2>소제목</h2><p><strong>굵게</strong> <em>기울임</em>&nbsp;띄어쓰기</p><ul><li>하나</li></ul>' +
    '<blockquote>인용</blockquote><img src="/uploads/abcdef.png" alt="설명">' +
    '<img src="https://res.cloudinary.com/demo/image/upload/v1/a.jpg"><a href="https://example.com">외부</a><a href="/category/x">내부</a>';
  const clean = sanitizeBody(html);
  assert.match(clean, /<h2>소제목<\/h2>/);
  assert.match(clean, /<strong>굵게<\/strong> <em>기울임<\/em> 띄어쓰기/);
  assert.match(clean, /<img src="\/uploads\/abcdef.png" alt="설명" \/>/);
  assert.match(clean, /res\.cloudinary\.com/);
  assert.match(clean, /<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer nofollow">외부<\/a>/);
  assert.match(clean, /<a href="\/category\/x">내부<\/a>/);
});

test('이미지 주소 허용 목록', () => {
  assert.ok(isAllowedImage('/uploads/abc123.webp'));
  assert.ok(isAllowedImage('/img/thumb/12.svg'));
  assert.ok(isAllowedImage('https://res.cloudinary.com/demo/image/upload/a.jpg'));
  assert.ok(!isAllowedImage('/uploads/abc.svg'), '업로드한 SVG는 허용하지 않음');
  assert.ok(!isAllowedImage('/uploads/../secret.png'));
  assert.ok(!isAllowedImage('http://res.cloudinary.com/a.jpg'));
  assert.ok(!isAllowedImage('https://res.cloudinary.com.evil.example/a.jpg'));
  assert.ok(!isAllowedImage('javascript:alert(1)'));
});

test('비밀번호: 해시로만 저장하고, 같은 비밀번호도 매번 다른 해시', async () => {
  const a = await hashPassword('correct horse battery');
  const b = await hashPassword('correct horse battery');
  assert.notEqual(a, b);
  assert.ok(!a.includes('correct'));
  assert.ok(await verifyPassword('correct horse battery', a));
  assert.ok(!(await verifyPassword('wrong password!!', a)));
  assert.ok(!(await verifyPassword('x', 'garbage')));
  assert.ok(checkPasswordRule('short'));
  assert.equal(checkPasswordRule('long-enough-pw'), null);
});

test('업로드 판별: 파일 내용으로 형식을 확인하고 SVG·HTML은 거절', () => {
  assert.equal(detectImage(PNG).ext, 'png');
  assert.equal(detectImage(Buffer.from('ffd8ffe000104a4649460001', 'hex')).ext, 'jpg');
  assert.equal(detectImage(Buffer.from('RIFF0000WEBPVP8 ', 'latin1')).ext, 'webp');
  assert.equal(detectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  assert.equal(detectImage(Buffer.from('<html><script>alert(1)</script></html>')), null);
  assert.equal(detectImage(undefined), null);
});

test('Cloudinary 설정 오류는 서버를 멈추지 않고, 업로드할 때 원인을 알려 준다', async () => {
  const png = { ext: 'png', mime: 'image/png' };
  const cases = [
    ['cloudinary://<your_api_key>:<your_api_secret>@demo', /예시 글자/],
    ['not a url', /형식이 올바르지 않습니다/],
    ['cloudinary://only-cloud-name', /형식이 올바르지 않습니다/]
  ];
  for (const [value, message] of cases) {
    const store = createImageStore({ cloudinaryUrl: value, production: true });
    assert.equal(store.kind, 'none');
    await assert.rejects(async () => store.save(PNG, png), (err) => err instanceof StorageUnavailableError && message.test(err.message));
  }
  const ok = createImageStore({ cloudinaryUrl: ' CLOUDINARY_URL=cloudinary://123:secret@demo ', production: true });
  assert.equal(ok.kind, 'cloudinary', '앞의 CLOUDINARY_URL=과 공백은 무시');
});

test('Cloudinary가 접속 정보를 거절하면(401) 설정을 확인하라고 알려 준다', async () => {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Invalid Signature' } }), { status: 401 });
  console.error = () => {};
  try {
    const store = createImageStore({ cloudinaryUrl: 'cloudinary://123:wrong@demo', production: true });
    await assert.rejects(store.save(PNG, { ext: 'png', mime: 'image/png' }),
      (err) => err instanceof StorageUnavailableError && /API Key, API Secret/.test(err.message));
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
  }
});

test('기사 입력 검사: 필수값, 카테고리, 주소 이름, 이미지 주소', () => {
  const { errors } = readArticleForm({ title: '', category: '없음', slug: 'Bad Slug!', thumbnail: 'https://evil.example/a.png', action: 'publish' });
  assert.deepEqual(Object.keys(errors).sort(), ['body_html', 'category', 'slug', 'thumbnail', 'title']);
  const ok = readArticleForm({ title: '제목', category: '패션', sub: '스타일', slug: '', body_html: '<p>본문</p>', action: 'draft' });
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.values.slug, 'article');
  assert.equal(ok.values.status, 'draft');
  assert.equal(ok.values.published_at, null);
  const wrongSub = readArticleForm({ title: '제목', category: '패션', sub: '레시피', action: 'draft' });
  assert.ok(wrongSub.errors.sub);
});

test('기사 입력 검사: 게시 시각은 한국 시간, 비우면 지금 또는 원래 시각', () => {
  const now = new Date('2026-10-28T00:00:00Z');
  const fresh = readArticleForm({ title: 't', category: '패션', body_html: '<p>b</p>', action: 'publish' }, { now });
  assert.equal(fresh.values.published_at, now);
  const original = new Date('2026-01-01T00:00:00Z');
  const kept = readArticleForm({ title: 't', category: '패션', body_html: '<p>b</p>', action: 'draft' }, { now, current: { published_at: original } });
  assert.equal(kept.values.published_at, original);
  assert.equal(parseKst('2026-10-28T18:30').toISOString(), '2026-10-28T09:30:00.000Z');
  assert.equal(toKstInput(new Date('2026-10-28T09:30:00Z')), '2026-10-28T18:30');
  assert.equal(parseKst('내일'), null);
});

test('로그인 제한: 5번 실패하면 막히고, 시간이 지나면 풀린다', () => {
  let t = 0;
  const limiter = createLoginLimiter({ max: 5, windowMs: 1000, now: () => t });
  for (let i = 0; i < 5; i++) limiter.fail(['ip:1']);
  assert.ok(limiter.blockedFor(['ip:1']) > 0);
  assert.equal(limiter.blockedFor(['ip:2']), 0);
  t = 1001;
  assert.equal(limiter.blockedFor(['ip:1']), 0);
});
