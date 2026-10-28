// 기사 작성 폼 입력 검사. 화면에서 막아도 서버에서 다시 확인한다.
import { findCategory } from '../data/categories.js';
import { isAllowedImage, plainText, sanitizeBody } from '../lib/sanitize.js';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KST_OFFSET = '+09:00';
export const MAX_BODY = 200 * 1024;

// 화면의 날짜 입력칸(datetime-local)은 시간대가 없으므로 한국 시간으로 해석한다.
export function parseKst(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00${KST_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toKstInput(date) {
  if (!date) return '';
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}

const text = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * @returns {{ values: object, errors: Record<string,string>, form: object }}
 *   values: DB에 넣을 값, errors: 칸별 오류 문구, form: 오류 시 다시 채워 줄 입력값
 */
export function readArticleForm(body, { now = new Date(), current = null } = {}) {
  const form = {
    title: text(body.title),
    deck: text(body.deck),
    category: text(body.category),
    sub: text(body.sub),
    slug: text(body.slug).toLowerCase(),
    thumbnail: text(body.thumbnail),
    body_html: typeof body.body_html === 'string' ? body.body_html : '',
    pinned: body.pinned === 'on' || body.pinned === 'true',
    published_at: text(body.published_at),
    action: body.action === 'publish' ? 'publish' : 'draft'
  };
  const errors = {};

  if (!form.title) errors.title = '제목을 입력하세요.';
  else if (form.title.length > 200) errors.title = '제목은 200자 이하로 입력하세요.';
  if (form.deck.length > 300) errors.deck = '보조 문장은 300자 이하로 입력하세요.';

  const category = findCategory(form.category);
  if (!category) errors.category = '카테고리를 선택하세요.';
  else if (form.sub && !category.subs.includes(form.sub)) errors.sub = '이 카테고리에 없는 세부 분류입니다.';

  if (!form.slug) form.slug = 'article';
  if (form.slug.length > 120 || !SLUG.test(form.slug)) {
    errors.slug = '영문 소문자, 숫자, 하이픈(-)만 쓸 수 있습니다. 예: winter-coat-guide';
  }

  if (form.thumbnail && !isAllowedImage(form.thumbnail)) errors.thumbnail = '허용되지 않은 이미지 주소입니다. 업로드한 이미지만 쓸 수 있습니다.';

  const bodyHtml = sanitizeBody(form.body_html);
  if (bodyHtml.length > MAX_BODY) errors.body_html = '본문이 너무 깁니다.';
  if (form.action === 'publish' && !plainText(bodyHtml) && !bodyHtml.includes('<img')) {
    errors.body_html = '게시하려면 본문을 입력하세요.';
  }

  // 게시 시각: 비워 두면 원래 시각을 유지하고, 처음 게시할 때는 지금. 미래 시각이면 예약 게시.
  let publishedAt = current?.published_at || null;
  if (form.published_at) {
    publishedAt = parseKst(form.published_at);
    if (!publishedAt) errors.published_at = '게시 시각 형식이 올바르지 않습니다.';
  } else if (form.action === 'publish' && !publishedAt) {
    publishedAt = now;
  }

  return {
    form,
    errors,
    values: {
      title: form.title,
      deck: form.deck,
      category: form.category,
      sub: form.sub || null,
      slug: form.slug,
      thumbnail: form.thumbnail || null,
      body_html: bodyHtml,
      pinned: form.pinned,
      status: form.action === 'publish' ? 'published' : 'draft',
      published_at: publishedAt
    }
  };
}
