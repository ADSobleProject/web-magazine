// 표시 규칙(명세 4-3): 조회수는 숫자, 게시 시각은 상대 표현.
const MINUTE = 60 * 1000;

export function formatCount(n) {
  return Number(n).toLocaleString('ko-KR');
}

export function relativeTime(iso, now = Date.now()) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  const minutes = Math.floor((now - time) / MINUTE);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  if (minutes < 60 * 24 * 30) return `${Math.floor(minutes / (60 * 24))}일 전`;
  const d = new Date(time);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// 이미지 주소: 같은 사이트 경로 또는 Cloudinary(https)만. 서버의 허용 목록(src/lib/sanitize.js)과 같게 유지한다.
const IMAGE_HOSTS = new Set(['res.cloudinary.com']);

export function safeImageUrl(url) {
  if (safeUrl(url)) return url;
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && IMAGE_HOSTS.has(u.hostname) ? url : null;
  } catch {
    return null;
  }
}

// API에서 받은 주소는 같은 사이트 경로(/로 시작, //는 제외) 또는 https만 허용한다.
// javascript: 같은 주소가 링크에 들어가는 것을 막는다.
export function safeUrl(url, { allowExternal = false } = {}) {
  if (typeof url !== 'string') return null;
  if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) return url;
  if (allowExternal) {
    try {
      if (new URL(url).protocol === 'https:') return url;
    } catch {
      return null;
    }
  }
  return null;
}
