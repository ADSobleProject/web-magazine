// 모든 응답에 붙는 보안 헤더. 외부 스크립트·스타일·글꼴·영상 플레이어를 쓰지 않으므로 같은 출처만 허용한다.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

export function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin'
  });
  // 운영 환경은 항상 https라서 브라우저가 이후 접속도 https로만 하도록 알린다. 로컬(http) 개발에는 붙이지 않는다.
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000');
  }
  next();
}

// 정식 주소가 아니면 301로 영구 이동시킨다(명세 5장).
// - SITE_ORIGIN이 설정되어 있으면 다른 호스트로 들어온 요청을 정식 호스트로 보낸다.
// - 경로 끝의 / 와 겹친 / 는 정리한다.
// 이동할 주소는 설정값과 정리된 경로로만 만든다. "//다른사이트" 같은 경로로 외부 이동(open redirect)이 생기지 않게
// 앞쪽 슬래시를 하나로 줄인다.
export function canonicalRedirect(siteOrigin) {
  const origin = siteOrigin ? new URL(siteOrigin) : null;
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const raw = req.originalUrl;
    const q = raw.indexOf('?');
    const rawPath = q < 0 ? raw : raw.slice(0, q);
    const query = q < 0 ? '' : raw.slice(q);

    let path = rawPath.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
    if (path.length > 1) path = path.replace(/\/+$/, '') || '/';

    const wrongHost = origin && req.get('host') !== origin.host;
    if (path === rawPath && !wrongHost) return next();

    res.redirect(301, (wrongHost ? origin.origin : '') + path + query);
  };
}
