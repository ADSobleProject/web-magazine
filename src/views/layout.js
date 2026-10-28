// 모든 화면이 공유하는 틀: 헤더, 카테고리 메뉴, 푸터(명세 2-3).
import { SITE } from '../config.js';
import { esc, jsonLdScript } from '../lib/html.js';
import { categoryUrl } from '../data/repository.js';

function themeLabel(theme) {
  return theme === 'dark' ? '밝은 화면으로 바꾸기' : '어두운 화면으로 바꾸기';
}

function header({ theme, categories, activeCategory }) {
  const nav = categories.map((c) => {
    const current = c.name === activeCategory ? ' aria-current="page"' : '';
    return `<li><a href="${esc(categoryUrl(c.name))}"${current}>${esc(c.name)}</a></li>`;
  }).join('');
  const links = SITE.headerLinks
    .map((l) => `<a class="tool" href="/info/${esc(l.key)}">${esc(l.label)}</a>`).join('');

  return `<header class="site">
  <div class="wrap bar">
    <a class="brand" href="/"><span class="mark" aria-hidden="true"></span>${esc(SITE.name)}</a>
    <div class="tools">
      <a class="tool" href="${esc(SITE.shopUrl)}" rel="noopener noreferrer" target="_blank">샵<span class="sr"> (새 창)</span></a>
      ${links}
      <button type="button" class="theme" id="theme-toggle" aria-label="${themeLabel(theme)}">
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 2a8 8 0 0 1 0 16z" fill="currentColor"/></svg>
      </button>
    </div>
  </div>
  <nav class="cats" aria-label="카테고리"><div class="wrap"><ul>${nav}</ul></div></nav>
</header>`;
}

function footer() {
  const links = SITE.footerLinks
    .map((l) => `<li><a href="/info/${esc(l.key)}">${esc(l.label)}</a></li>`).join('');
  return `<footer class="site-foot">
  <div class="wrap">
    <a class="brand" href="/"><span class="mark" aria-hidden="true"></span>${esc(SITE.name)}</a>
    <ul>${links}</ul>
    <p>${esc(SITE.company)}</p>
  </div>
</footer>`;
}

/**
 * @param {object} o
 * @param {string|null} o.title 페이지 제목. 없으면 사이트 이름만 쓴다.
 * @param {string} o.path 정식 주소 경로(인코딩된 값)
 * @param {'home'|'category'|'article'|'info'|'notfound'} o.page
 */
export function layout({
  title = null, description = SITE.description, path = '/', page, theme = null,
  categories, activeCategory = null, main, jsonLd = null, robots = null, mainAttrs = '', image = null
}) {
  const fullTitle = title ? `${title} | ${SITE.name}` : SITE.name;
  const canonical = SITE.origin ? SITE.origin + path : null;

  return `<!DOCTYPE html>
<html lang="ko"${theme ? ` data-theme="${theme}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
${robots ? `<meta name="robots" content="${esc(robots)}">\n` : ''}${canonical ? `<link rel="canonical" href="${esc(canonical)}">\n<meta property="og:url" content="${esc(canonical)}">\n` : ''}<meta property="og:type" content="${page === 'article' ? 'article' : 'website'}">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
${image ? `<meta property="og:image" content="${esc(image)}">
` : ''}<meta name="twitter:card" content="summary_large_image">
<meta name="color-scheme" content="light dark">
<link rel="stylesheet" href="/css/site.css">
<script src="/js/theme-init.js"></script>
<script type="module" src="/js/main.js"></script>
${jsonLd ? jsonLdScript(jsonLd) + '\n' : ''}</head>
<body data-page="${page}">
<a class="skip" href="#main">본문으로 건너뛰기</a>
${header({ theme, categories, activeCategory })}
<main id="main" tabindex="-1"${mainAttrs}>
${main}
</main>
${footer()}
<div class="sr" id="live" aria-live="polite"></div>
</body>
</html>`;
}
