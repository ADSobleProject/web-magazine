// 화면별 본문. 목록 내용은 브라우저가 API로 받아 채우고, 서버는 틀과 자리 표시만 그린다(명세 3장 A).
import { SITE } from '../config.js';
import { esc } from '../lib/html.js';
import { categoryUrl } from '../data/repository.js';

export const TABS = [
  { key: 'popular', label: '인기' },
  { key: 'featured', label: '기획' },
  { key: 'rising', label: '급상승' }
];

const NOSCRIPT = '<noscript><p class="end">목록을 보려면 브라우저에서 자바스크립트를 켜 주세요.</p></noscript>';

const skCard = '<div class="sk-card"><div class="sk r43"></div><div class="sk line w40"></div><div class="sk line"></div><div class="sk line w70"></div></div>';
const skRow = '<div class="row no-rank"><div class="sk r43"></div><div><div class="sk line w40"></div><div class="sk line"></div></div></div>';
const skVideo = '<div class="vid"><div class="sk r916"></div><div class="sk line"></div></div>';

export const skeleton = {
  panel: `<div class="panel"><div>${skCard}</div><div class="side">${skRow.repeat(4)}</div></div>`,
  grid: (n) => `<div class="grid">${skCard.repeat(n)}</div>`,
  videos: `<div class="vids">${skVideo.repeat(6)}</div>`
};

export function homeMain() {
  const tabs = TABS.map((t, i) =>
    `<button type="button" class="tab" role="tab" id="tab-${t.key}" data-tab="${t.key}" aria-controls="tabpanel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${t.label}</button>`
  ).join('');

  return `<div class="wrap">
<section id="banner" class="banner" aria-label="알림" hidden></section>
<section class="sec-tabs" aria-labelledby="h-tabs">
  <h2 class="sr" id="h-tabs">콘텐츠 모음</h2>
  <div class="tabs" role="tablist" aria-label="콘텐츠 모음">${tabs}</div>
  <div id="tabpanel" role="tabpanel" aria-labelledby="tab-${TABS[0].key}" aria-busy="true">${skeleton.panel}</div>
</section>
<section class="sec" aria-labelledby="h-latest">
  <h2 class="sec-title" id="h-latest">최신 기사</h2>
  <div id="latest" aria-busy="true">${skeleton.grid(6)}</div>
</section>
<section class="sec" aria-labelledby="h-videos">
  <h2 class="sec-title" id="h-videos">짧은 영상</h2>
  <div id="videos" aria-busy="true">${skeleton.videos}</div>
</section>
${NOSCRIPT}
</div>`;
}

export function categoryMain(category, sub) {
  const chip = (label, value) => {
    const current = (value || null) === (sub || null) ? ' aria-current="page"' : '';
    return `<a class="chip" href="${esc(categoryUrl(category.name, value))}"${current}>${esc(label)}</a>`;
  };
  return `<div class="wrap">
<div class="cat-head">
  <h1>${esc(category.name)}</h1>
  <nav class="chips" aria-label="세부 분류">${chip('전체', null)}${category.subs.map((s) => chip(s, s)).join('')}</nav>
</div>
<div id="cat-body" aria-busy="true">
  <div class="feats">${skeleton.grid(2)}</div>
  ${skeleton.grid(6)}
</div>
${NOSCRIPT}
</div>`;
}

// 기사 상세는 이번 범위 밖이라 안내만 보여 준다(명세 3장 F).
export function articleMain(article) {
  return `<div class="wrap article-stub">
<p class="meta"><a class="cat" href="${esc(article.categoryUrl)}">${esc(article.category)}</a></p>
<h1>${esc(article.title)}</h1>
<p class="s">${esc(article.deck)}</p>
<div class="notice"><p>기사 본문 화면은 준비 중입니다.</p></div>
<a class="more" href="/">메인으로 이동</a>
</div>`;
}

export function infoMain(label) {
  return `<div class="wrap notfound">
<h1>${esc(label)}</h1>
<p>이 페이지는 준비 중입니다.</p>
<a class="more" href="/">메인으로 이동</a>
</div>`;
}

export function notFoundMain(message = '주소를 다시 확인하거나 메인에서 원하는 분류를 선택하세요.') {
  return `<div class="wrap notfound">
<h1>찾을 수 없는 페이지입니다</h1>
<p>${esc(message)}</p>
<a class="more" href="/">메인으로 이동</a>
</div>`;
}

export function homeJsonLd() {
  const data = { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, description: SITE.description };
  if (SITE.origin) data.url = SITE.origin + '/';
  return data;
}

export function categoryJsonLd(category) {
  const item = (name, path) => (SITE.origin ? { name, item: SITE.origin + path } : { name });
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [item(SITE.name, '/'), item(category.name, categoryUrl(category.name))]
      .map((x, i) => ({ '@type': 'ListItem', position: i + 1, ...x }))
  };
}

export function articleJsonLd(article) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.deck,
    datePublished: article.publishedAt,
    articleSection: article.category
  };
}
