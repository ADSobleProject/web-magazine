// 관리자 화면 공통 처리: 로그인 쿠키 읽기, 로그인 확인, CSRF 확인.
import { timingSafeEqual } from 'node:crypto';
import { parseCookies } from '../lib/html.js';
import { SESSION_DAYS } from './users.js';

// 운영(https)에서는 __Host- 접두사로 다른 하위 도메인이 쿠키를 덮어쓰지 못하게 한다.
const SECURE = () => process.env.NODE_ENV === 'production';
export const cookieName = () => (SECURE() ? '__Host-sid' : 'sid');

export function setSessionCookie(res, token) {
  res.cookie(cookieName(), token, {
    httpOnly: true,
    secure: SECURE(),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(cookieName(), { httpOnly: true, secure: SECURE(), sameSite: 'lax', path: '/' });
}

export function readSessionToken(req) {
  return parseCookies(req.headers.cookie)[cookieName()];
}

export function loadSession(users) {
  return async (req, res, next) => {
    const session = await users.findSession(readSessionToken(req));
    req.user = session?.user || null;
    req.csrf = session?.csrf || null;
    next();
  };
}

export function requireLogin(req, res, next) {
  if (req.user) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'login_required' });
  res.redirect(303, '/admin/login');
}

function sameToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// 상태를 바꾸는 요청(POST 등)은 세션에 묶인 CSRF 토큰이 같아야 하고, 다른 사이트에서 온 요청이 아니어야 한다.
export function requireCsrf(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const origin = req.get('origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) {
    return res.status(403).type('text').send('다른 사이트에서 보낸 요청은 처리하지 않습니다.');
  }
  const token = req.get('x-csrf-token') || req.body?._csrf;
  if (!sameToken(token, req.csrf)) {
    return res.status(403).type('text').send('요청이 만료되었습니다. 화면을 새로 고친 뒤 다시 시도하세요.');
  }
  next();
}
