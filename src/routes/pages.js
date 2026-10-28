import { Router } from 'express';
import { SITE } from '../config.js';
import { themeFromCookie } from '../lib/html.js';
import { plainText } from '../lib/sanitize.js';
import { layout } from '../views/layout.js';
import { articleUrl, categoryUrl } from '../data/repository.js';
import {
  homeMain, categoryMain, articleMain, infoMain, notFoundMain,
  homeJsonLd, categoryJsonLd, articleJsonLd
} from '../views/pages.js';

// 기사 주소: "번호-영문요약". 번호로만 찾고 요약 이름이 다르면 정식 주소로 이동한다(명세 2-3).
const ARTICLE_REF = /^(\d{1,9})(?:-[a-z0-9-]{1,120})?$/;

// 공유 미리보기 이미지는 전체 주소여야 한다. 우리 서버 이미지는 정식 주소가 설정됐을 때만 붙인다.
function absoluteImage(url) {
  if (!url) return null;
  if (/^https:\/\//.test(url)) return url;
  return SITE.origin && url.startsWith('/') ? SITE.origin + url : null;
}

export function sendPage(req, res, repo, opts, status = 200) {
  res.status(status)
    .set('Cache-Control', 'private, no-cache')
    .set('Vary', 'Cookie')
    .type('html')
    // 테마 쿠키로 첫 화면부터 맞는 테마를 그린다(명세 6장 다크 모드).
    .send(layout({ theme: themeFromCookie(req.headers.cookie), categories: repo.categories(), ...opts }));
}

function articleOpts(article, related, extra = {}) {
  const image = absoluteImage(article.thumbnail);
  return {
    title: article.title,
    description: article.deck || plainText(article.bodyHtml).slice(0, 150),
    page: 'article',
    path: articleUrl(article),
    activeCategory: article.category,
    image,
    main: articleMain(article, related, extra),
    jsonLd: articleJsonLd(article, image)
  };
}

// 관리자 미리보기: 임시저장·예약 기사도 공개 화면 모양으로 그린다. 검색 엔진에는 노출하지 않는다.
export function renderPreview(repo, now) {
  return async (req, res, row) => {
    const article = {
      id: row.id,
      slug: row.slug,
      title: row.title,
      deck: row.deck,
      category: row.category,
      categoryUrl: categoryUrl(row.category),
      sub: row.sub,
      views: row.views,
      publishedAt: row.published_at ? row.published_at.toISOString() : null,
      updatedAt: row.updated_at.toISOString(),
      thumbnail: row.thumbnail,
      bodyHtml: row.body_html,
      visible: row.status === 'published' && row.published_at <= now()
    };
    const related = await repo.related(article);
    sendPage(req, res, repo, { ...articleOpts(article, related, { preview: true }), robots: 'noindex', jsonLd: null });
  };
}

export function pageRouter(repo) {
  const router = Router();
  const render = (req, res, opts, status) => sendPage(req, res, repo, opts, status);

  const notFound = (req, res, message) => render(req, res, {
    title: '찾을 수 없는 페이지', page: 'notfound', robots: 'noindex', main: notFoundMain(message)
  }, 404);

  router.get('/', (req, res) => {
    render(req, res, { page: 'home', path: '/', main: homeMain(), jsonLd: homeJsonLd() });
  });

  router.get('/category/:name', (req, res) => {
    const category = repo.findCategory(req.params.name);
    if (!category) return notFound(req, res, '없는 분류입니다. 메뉴에서 원하는 분류를 선택하세요.');

    // 목록에 없는 세부 분류는 전체 보기로 돌려보낸다.
    const { sub } = req.query;
    if (sub !== undefined && (typeof sub !== 'string' || !category.subs.includes(sub))) {
      return res.redirect(302, categoryUrl(category.name));
    }

    render(req, res, {
      title: category.name,
      description: `${category.name} 분야의 최신 기사를 모아 봅니다. ${SITE.description}`,
      page: 'category',
      path: categoryUrl(category.name),
      activeCategory: category.name,
      main: categoryMain(category, sub),
      jsonLd: categoryJsonLd(category),
      mainAttrs: ` data-category="${encodeURIComponent(category.name)}"${sub ? ` data-sub="${encodeURIComponent(sub)}"` : ''}`
    });
  });

  router.get('/article/:ref', async (req, res) => {
    const match = ARTICLE_REF.exec(req.params.ref);
    const article = match && (await repo.findArticle(Number(match[1])));
    if (!article) return notFound(req, res, '없는 기사이거나 삭제된 기사입니다.');

    const canonical = articleUrl(article);
    if (req.path !== canonical) return res.redirect(301, canonical);

    // 브라우저가 미리 받기로 가져간 요청은 조회수에 넣지 않는다.
    if (!/prefetch/i.test(req.get('sec-purpose') || req.get('purpose') || '')) {
      repo.addView(article.id).catch((err) => console.error('조회수 기록 실패', err));
    }
    render(req, res, articleOpts(article, await repo.related(article)));
  });

  router.get('/info/:key', (req, res) => {
    const link = SITE.footerLinks.find((l) => l.key === req.params.key);
    if (!link) return notFound(req, res);
    render(req, res, { title: link.label, page: 'info', path: `/info/${link.key}`, main: infoMain(link.label) });
  });

  router.use((req, res) => notFound(req, res));

  return router;
}
