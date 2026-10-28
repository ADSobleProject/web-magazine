import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeCursor, decodeCursor } from '../src/lib/cursor.js';
import { esc, jsonLdScript, parseCookies, themeFromCookie } from '../src/lib/html.js';
import { formatCount, formatDuration, relativeTime, safeUrl } from '../public/js/lib/format.js';

test('위치값: 만든 값을 그대로 되읽는다', () => {
  const c = encodeCursor({ publishedAt: 1761609600000, id: 123 });
  assert.deepEqual(decodeCursor(c), { publishedAt: 1761609600000, id: 123 });
});

test('위치값: 형식이 틀리면 null', () => {
  for (const bad of ['', 'abc', '!!!', 'x'.repeat(200), undefined, ['a'], 123,
    Buffer.from('{"a":1}').toString('base64url'),
    Buffer.from('[1.5,2]').toString('base64url'),
    Buffer.from('[1,2,3]').toString('base64url')]) {
    assert.equal(decodeCursor(bad), null, String(bad));
  }
});

test('시간 표시: 상대 표현', () => {
  const now = Date.parse('2026-10-28T12:00:00Z');
  const ago = (m) => new Date(now - m * 60000).toISOString();
  assert.equal(relativeTime(ago(0), now), '방금 전');
  assert.equal(relativeTime(ago(5), now), '5분 전');
  assert.equal(relativeTime(ago(125), now), '2시간 전');
  assert.equal(relativeTime(ago(60 * 24 * 3), now), '3일 전');
  assert.match(relativeTime(ago(60 * 24 * 40), now), /^2026\. 9\. \d+\.$/);
  assert.equal(relativeTime('잘못된 값', now), '');
});

test('숫자와 길이 표시', () => {
  assert.equal(formatCount(12345), '12,345');
  assert.equal(formatDuration(45), '0:45');
  assert.equal(formatDuration(65), '1:05');
});

test('링크 주소 검사: 위험한 주소는 막는다', () => {
  assert.equal(safeUrl('/article/1-a'), '/article/1-a');
  assert.equal(safeUrl('//evil.com'), null);
  assert.equal(safeUrl('/\\evil.com'), null);
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('https://video.example.com/x'), null);
  assert.equal(safeUrl('https://video.example.com/x', { allowExternal: true }), 'https://video.example.com/x');
  assert.equal(safeUrl('http://video.example.com/x', { allowExternal: true }), null);
  assert.equal(safeUrl('javascript:alert(1)', { allowExternal: true }), null);
});

test('HTML 안전 처리', () => {
  assert.equal(esc('<a href="x">\'&'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  const script = jsonLdScript({ headline: '</script><script>alert(1)</script>' });
  assert.ok(!script.slice(0, -'</script>'.length).includes('</script>'));
});

test('테마 쿠키: dark/light만 받아들인다', () => {
  assert.equal(themeFromCookie('a=1; theme=dark'), 'dark');
  assert.equal(themeFromCookie('theme=light'), 'light');
  assert.equal(themeFromCookie('theme="><script>'), null);
  assert.equal(themeFromCookie(undefined), null);
  assert.deepEqual(parseCookies('x=%E0%A4%A; y=2'), { y: '2' });
});
