// 기사 본문 HTML 정리. 편집기에서 온 HTML은 믿지 않고, 허용한 태그·속성·주소만 남긴다.
// 저장할 때와 화면에 보여 줄 때 두 번 거친다.
import sanitizeHtml from 'sanitize-html';

const IMAGE_HOSTS = new Set(['res.cloudinary.com']);
const LOCAL_IMAGE = /^\/(uploads|img\/thumb)\/[A-Za-z0-9_-]+\.(jpg|png|gif|webp|svg)$/;

// 기사에 쓸 수 있는 이미지 주소: 우리 서버의 업로드·샘플 이미지 또는 Cloudinary(https)
export function isAllowedImage(url) {
  if (typeof url !== 'string' || url.length > 500) return false;
  if (LOCAL_IMAGE.test(url)) return !url.startsWith('/uploads/') || !url.endsWith('.svg');
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && IMAGE_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

const ALIGN = ['ql-align-center', 'ql-align-right', 'ql-align-justify'];
const INDENT = /^ql-indent-[1-8]$/;

const OPTIONS = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'img', 'pre', 'code', 'hr'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt'],
    p: ['class'],
    h2: ['class'],
    h3: ['class'],
    li: ['class']
  },
  allowedClasses: {
    p: [...ALIGN, INDENT],
    h2: ALIGN,
    h3: ALIGN,
    li: [INDENT]
  },
  allowedSchemes: ['https', 'http', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  // 허용하지 않은 주소의 이미지(외부 사이트, data: 등)는 통째로 뺀다.
  exclusiveFilter: (frame) => frame.tag === 'img' && !isAllowedImage(frame.attribs.src),
  transformTags: {
    // 외부 링크는 새 창으로 열고, 열린 페이지가 우리 페이지를 조작하지 못하게 한다.
    a: (tagName, attribs) => {
      const external = /^https?:/i.test(attribs.href || '');
      return {
        tagName,
        attribs: external
          ? { href: attribs.href, target: '_blank', rel: 'noopener noreferrer nofollow' }
          : { href: attribs.href }
      };
    },
    b: 'strong',
    i: 'em'
  }
};

export function sanitizeBody(html) {
  return sanitizeHtml(String(html ?? ''), OPTIONS)
    // 편집기가 띄어쓰기를 &nbsp;로 바꾸는 경우가 있어 일반 공백으로 돌린다(줄바꿈이 안 되는 문제 방지).
    .replace(/&nbsp;| /g, ' ')
    .trim();
}

// 목록·검색 노출용으로 태그를 뺀 글자만
export function plainText(html) {
  return sanitizeHtml(String(html ?? ''), { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
}
