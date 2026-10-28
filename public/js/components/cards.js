// 기사 카드는 어디서나 같은 정보 구조를 쓴다: 썸네일 1, 제목 1, 보조 문장 1(명세 2-3).
import { el } from '../lib/dom.js';
import { formatCount, formatDuration, relativeTime, safeImageUrl, safeUrl } from '../lib/format.js';

export const FALLBACK_IMAGE = '/img/fallback.svg';

// 이미지 자리를 비율로 미리 확보해 목록이 흔들리지 않게 하고, 실패하면 대체 이미지로 바꾼다.
export function thumb(src, alt, ratio = 'r43') {
  const img = el('img', {
    src: safeImageUrl(src) || FALLBACK_IMAGE,
    alt,
    width: 400,
    height: 300,
    loading: 'lazy',
    decoding: 'async'
  });
  img.addEventListener('error', () => {
    if (!img.src.endsWith(FALLBACK_IMAGE)) img.src = FALLBACK_IMAGE;
  });
  return el('div', { class: `art ${ratio}` }, img);
}

function meta(item) {
  return el('div', { class: 'meta' },
    el('span', { class: 'cat', text: item.category }),
    el('span', { text: `조회 ${formatCount(item.views)}` }),
    el('time', { datetime: item.publishedAt, text: relativeTime(item.publishedAt) })
  );
}

// size: '' | 'lg'(카테고리 대표) | 'xl'(탭 첫 기사)
export function articleCard(item, size = '') {
  return el('a', { class: 'card', href: safeUrl(item.url) || '#' },
    thumb(item.thumbnail, item.title),
    meta(item),
    el('h3', { class: `t ${size}`.trim(), text: item.title }),
    el('p', { class: 's', text: item.deck })
  );
}

export function rankRow(item, rank) {
  return el('a', { class: rank ? 'row' : 'row no-rank', href: safeUrl(item.url) || '#' },
    rank ? el('span', { class: 'rank', 'aria-label': `${rank}위`, text: String(rank) }) : null,
    thumb(item.thumbnail, item.title),
    el('div', {}, meta(item), el('h3', { class: 't sm', text: item.title }))
  );
}

// 영상은 직접 재생하지 않고 외부 영상 서비스로 이동하는 링크다. 플레이어를 불러오지 않으므로
// 화면 밖 영상 때문에 요청이 늘어나는 일이 없다(명세 6장 영상 로딩).
export function videoCard(video) {
  const href = safeUrl(video.url, { allowExternal: true });
  const body = [
    el('div', { class: 'art r916' },
      thumb(video.thumbnail, '', 'r916').firstChild,
      el('span', { class: 'dur', text: formatDuration(video.duration) }),
      el('span', { class: 'play', 'aria-hidden': 'true' })
    ),
    el('p', { class: 'vt', text: video.title })
  ];
  if (!href) return el('div', { class: 'vid' }, ...body);
  return el('a', { class: 'vid', href, target: '_blank', rel: 'noopener noreferrer' },
    ...body,
    el('span', { class: 'sr', text: ' (새 창, 외부 영상 서비스)' })
  );
}

export function errorNotice(message, onRetry) {
  return el('div', { class: 'notice', role: 'alert' },
    el('p', { text: message }),
    el('button', { type: 'button', onclick: onRetry, text: '다시 시도' })
  );
}
