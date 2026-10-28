// 서버에서 HTML에 값을 넣을 때는 반드시 esc()를 거친다.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

// 구조화 데이터. "</script>"로 태그를 빠져나가지 못하게 < 를 유니코드 이스케이프한다.
export function jsonLdScript(data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    if (!key || key in cookies) continue;
    try {
      cookies[key] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      // 잘못 인코딩된 쿠키는 무시
    }
  }
  return cookies;
}

export function themeFromCookie(header) {
  const theme = parseCookies(header).theme;
  return theme === 'dark' || theme === 'light' ? theme : null;
}
