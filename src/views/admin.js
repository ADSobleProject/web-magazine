// 관리자 화면. 공개 사이트와 틀을 공유하지 않고, 검색 엔진에 노출되지 않게 한다.
import { SITE } from '../config.js';
import { CATEGORIES } from '../data/categories.js';
import { esc } from '../lib/html.js';
import { formatKst } from '../lib/time.js';
import { toKstInput } from '../admin/articleForm.js';
import { PASSWORD_RULE } from '../auth/password.js';

const STATE_LABEL = { published: '게시됨', scheduled: '예약', draft: '임시저장' };

export function adminLayout({ title, user = null, csrf = '', main, scripts = '', head = '' }) {
  const nav = user
    ? `<nav class="a-nav" aria-label="관리자 메뉴">
  <a href="/admin">기사 목록</a>
  <a href="/admin/articles/new">새 기사</a>
  <a href="/" target="_blank" rel="noopener">사이트 보기</a>
  <span class="a-user">${esc(user.name)}</span>
  <form method="post" action="/admin/logout"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button type="submit" class="a-link">로그아웃</button></form>
</nav>`
    : '';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
${csrf ? `<meta name="csrf-token" content="${esc(csrf)}">\n` : ''}<title>${esc(title)} | ${esc(SITE.name)} 관리자</title>
<link rel="stylesheet" href="/css/admin.css">
${head}
<script type="module" src="/js/admin/common.js"></script>
${scripts}
</head>
<body>
<header class="a-head">
  <a class="a-brand" href="/admin">${esc(SITE.name)} 관리자</a>
  ${nav}
</header>
<main class="a-main">
${main}
</main>
</body>
</html>`;
}

function fieldError(errors, name) {
  return errors[name] ? `<p class="a-error" id="err-${name}">${esc(errors[name])}</p>` : '';
}
const described = (errors, name) => (errors[name] ? ` aria-invalid="true" aria-describedby="err-${name}"` : '');

export function loginMain({ email = '', error = '', setupAvailable = false }) {
  return `<section class="a-card a-narrow">
<h1>로그인</h1>
${error ? `<p class="a-alert" role="alert">${esc(error)}</p>` : ''}
<form method="post" action="/admin/login" class="a-form">
  <label>이메일<input type="email" name="email" value="${esc(email)}" autocomplete="username" required></label>
  <label>비밀번호<input type="password" name="password" autocomplete="current-password" required></label>
  <button type="submit" class="a-btn primary">로그인</button>
</form>
${setupAvailable ? '<p class="a-hint">아직 관리자 계정이 없습니다. <a href="/admin/setup">첫 관리자 만들기</a></p>' : ''}
</section>`;
}

export function setupMain({ form = {}, errors = {} }) {
  return `<section class="a-card a-narrow">
<h1>첫 관리자 만들기</h1>
<p class="a-hint">이 화면은 관리자가 한 명도 없을 때만 열립니다. 서버 설정에 넣어 둔 설정 코드(ADMIN_SETUP_TOKEN)가 필요합니다.</p>
${errors.form ? `<p class="a-alert" role="alert">${esc(errors.form)}</p>` : ''}
<form method="post" action="/admin/setup" class="a-form">
  <label>설정 코드<input type="password" name="token" autocomplete="off" required${described(errors, 'token')}></label>
  ${fieldError(errors, 'token')}
  <label>이름<input name="name" value="${esc(form.name || '')}" maxlength="50" required${described(errors, 'name')}></label>
  ${fieldError(errors, 'name')}
  <label>이메일<input type="email" name="email" value="${esc(form.email || '')}" autocomplete="username" required${described(errors, 'email')}></label>
  ${fieldError(errors, 'email')}
  <label>비밀번호 <span class="a-hint">${PASSWORD_RULE.min}자 이상</span><input type="password" name="password" autocomplete="new-password" minlength="${PASSWORD_RULE.min}" required${described(errors, 'password')}></label>
  ${fieldError(errors, 'password')}
  <label>비밀번호 확인<input type="password" name="password2" autocomplete="new-password" required></label>
  <button type="submit" class="a-btn primary">관리자 만들기</button>
</form>
</section>`;
}

export function listMain({ result, counts, status, q, csrf, notice = '' }) {
  const tab = (key, label, n) => {
    const href = `/admin${key ? `?status=${key}` : ''}`;
    return `<a href="${href}"${(status || '') === (key || '') ? ' aria-current="page"' : ''}>${label} <span>${n}</span></a>`;
  };
  const rows = result.items.map((a) => `<tr>
    <td><a href="/admin/articles/${a.id}">${esc(a.title)}</a>${a.is_sample ? ' <span class="a-tag">샘플</span>' : ''}${a.pinned ? ' <span class="a-tag">기획 고정</span>' : ''}</td>
    <td>${esc(a.category)}${a.sub ? ` · ${esc(a.sub)}` : ''}</td>
    <td><span class="a-state ${a.state}">${STATE_LABEL[a.state]}</span></td>
    <td>${esc(formatKst(a.published_at)) || '-'}</td>
    <td class="num">${a.views.toLocaleString('ko-KR')}</td>
  </tr>`).join('');

  const pageLink = (p) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    params.set('page', p);
    return `/admin?${params}`;
  };

  return `<div class="a-bar">
  <h1>기사 목록</h1>
  <a class="a-btn primary" href="/admin/articles/new">새 기사 쓰기</a>
</div>
${notice ? `<p class="a-notice" role="status">${esc(notice)}</p>` : ''}
<nav class="a-tabs" aria-label="상태">
  ${tab('', '전체', counts.all)}${tab('published', '게시됨', counts.published)}${tab('scheduled', '예약', counts.scheduled)}${tab('draft', '임시저장', counts.draft)}
</nav>
<form class="a-search" method="get" action="/admin">
  ${status ? `<input type="hidden" name="status" value="${esc(status)}">` : ''}
  <label class="sr" for="q">제목 검색</label>
  <input id="q" type="search" name="q" value="${esc(q)}" placeholder="제목 검색">
  <button type="submit" class="a-btn">검색</button>
</form>
${result.items.length ? `<table class="a-table">
  <thead><tr><th>제목</th><th>분류</th><th>상태</th><th>게시 시각</th><th class="num">조회</th></tr></thead>
  <tbody>${rows}</tbody>
</table>` : '<p class="a-empty">기사가 없습니다.</p>'}
${result.pages > 1 ? `<nav class="a-pages" aria-label="페이지">${result.page > 1 ? `<a href="${esc(pageLink(result.page - 1))}">이전</a>` : ''}<span>${result.page} / ${result.pages}</span>${result.page < result.pages ? `<a href="${esc(pageLink(result.page + 1))}">다음</a>` : ''}</nav>` : ''}
<section class="a-tools">
  <h2>관리 도구</h2>
  <a class="a-btn" href="/admin/export">전체 기사 백업 내려받기 (JSON)</a>
  ${counts.samples ? `<form method="post" action="/admin/samples/delete" data-confirm="샘플 기사 ${counts.samples}건을 모두 삭제합니다. 되돌릴 수 없습니다. 계속할까요?">
    <input type="hidden" name="_csrf" value="${esc(csrf)}">
    <button type="submit" class="a-btn danger">샘플 기사 모두 삭제 (${counts.samples}건)</button>
  </form>` : ''}
</section>`;
}

export function editMain({ article = null, form, errors = {}, csrf, notice = '' }) {
  const isNew = !article;
  const category = CATEGORIES.find((c) => c.name === form.category);
  const catOptions = ['<option value="">선택하세요</option>']
    .concat(CATEGORIES.map((c) => `<option${c.name === form.category ? ' selected' : ''}>${esc(c.name)}</option>`)).join('');
  // 세부 분류 목록은 카테고리에 따라 바뀌므로 전체를 data로 넘기고 화면 코드가 갈아 끼운다.
  const subOptions = ['<option value="">없음</option>']
    .concat((category?.subs || []).map((s) => `<option${s === form.sub ? ' selected' : ''}>${esc(s)}</option>`)).join('');
  const subsData = esc(JSON.stringify(Object.fromEntries(CATEGORIES.map((c) => [c.name, c.subs]))));
  const hasErrors = Object.keys(errors).length > 0;

  return `<div class="a-bar">
  <h1>${isNew ? '새 기사' : '기사 수정'}</h1>
  ${article ? `<span class="a-state ${article.state}">${STATE_LABEL[article.state]}</span>
  <a class="a-btn" href="/admin/articles/${article.id}/preview" target="_blank" rel="noopener">미리보기</a>` : ''}
</div>
${notice ? `<p class="a-notice" role="status">${esc(notice)}</p>` : ''}
${hasErrors ? '<p class="a-alert" role="alert">입력한 내용을 확인해 주세요.</p>' : ''}
<form id="article-form" method="post" action="${isNew ? '/admin/articles' : `/admin/articles/${article.id}`}" class="a-form a-edit" novalidate>
  <input type="hidden" name="_csrf" value="${esc(csrf)}">
  <div class="a-col main">
    <label>제목<input name="title" value="${esc(form.title)}" maxlength="200" required${described(errors, 'title')}></label>
    ${fieldError(errors, 'title')}
    <label>보조 문장<input name="deck" value="${esc(form.deck)}" maxlength="300"${described(errors, 'deck')}></label>
    ${fieldError(errors, 'deck')}
    <div class="a-label" id="body-label">본문</div>
    <div class="a-editor-wrap"${errors.body_html ? ' data-invalid="true"' : ''}>
      <div id="editor" aria-labelledby="body-label"></div>
    </div>
    <textarea id="body_html" name="body_html" hidden>${esc(form.body_html)}</textarea>
    ${fieldError(errors, 'body_html')}
    <noscript><p class="a-alert">본문 편집기를 쓰려면 자바스크립트를 켜 주세요.</p></noscript>
  </div>
  <div class="a-col side">
    <fieldset>
      <legend>분류</legend>
      <label>카테고리<select name="category" id="category" data-subs="${subsData}" required${described(errors, 'category')}>${catOptions}</select></label>
      ${fieldError(errors, 'category')}
      <label>세부 분류<select name="sub" id="sub"${described(errors, 'sub')}>${subOptions}</select></label>
      ${fieldError(errors, 'sub')}
      <label class="a-check"><input type="checkbox" name="pinned"${form.pinned ? ' checked' : ''}> 기획 탭에 고정</label>
    </fieldset>
    <fieldset>
      <legend>대표 이미지</legend>
      <div class="a-thumb" id="thumb-preview">${form.thumbnail ? `<img src="${esc(form.thumbnail)}" alt="">` : '<span>없음</span>'}</div>
      <input type="hidden" name="thumbnail" id="thumbnail" value="${esc(form.thumbnail)}">
      <div class="a-row">
        <button type="button" class="a-btn" id="thumb-pick">이미지 올리기</button>
        <button type="button" class="a-btn" id="thumb-clear"${form.thumbnail ? '' : ' hidden'}>빼기</button>
      </div>
      <p class="a-hint">JPG, PNG, WEBP, GIF · 5MB 이하</p>
      ${fieldError(errors, 'thumbnail')}
    </fieldset>
    <fieldset>
      <legend>주소와 게시</legend>
      <label>주소용 영문 이름<input name="slug" value="${esc(form.slug)}" maxlength="120" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="winter-coat-guide"${described(errors, 'slug')}></label>
      <p class="a-hint">영문 소문자·숫자·하이픈. 주소가 /article/번호-이름 이 됩니다.</p>
      ${fieldError(errors, 'slug')}
      <label>게시 시각 (한국 시간)<input type="datetime-local" name="published_at" value="${esc(form.published_at)}"${described(errors, 'published_at')}></label>
      <p class="a-hint">비워 두면 게시 버튼을 누른 시각. 미래로 정하면 그때 공개됩니다(예약).</p>
      ${fieldError(errors, 'published_at')}
    </fieldset>
    <div class="a-actions">
      <button type="submit" name="action" value="publish" class="a-btn primary">${article?.status === 'published' ? '게시 상태로 저장' : '게시'}</button>
      <button type="submit" name="action" value="draft" class="a-btn">${article?.status === 'published' ? '게시 내리고 임시저장' : '임시저장'}</button>
    </div>
  </div>
</form>
${article ? `<form method="post" action="/admin/articles/${article.id}/delete" class="a-delete" data-confirm="이 기사를 삭제합니다. 되돌릴 수 없습니다. 계속할까요?">
  <input type="hidden" name="_csrf" value="${esc(csrf)}">
  <button type="submit" class="a-btn danger">기사 삭제</button>
</form>` : ''}`;
}

// DB의 기사 행을 편집 폼 값으로
export function formFromArticle(a) {
  return {
    title: a.title,
    deck: a.deck,
    category: a.category,
    sub: a.sub || '',
    slug: a.slug,
    thumbnail: a.thumbnail || '',
    body_html: a.body_html,
    pinned: a.pinned,
    published_at: toKstInput(a.published_at)
  };
}

export const EMPTY_FORM = {
  title: '', deck: '', category: '', sub: '', slug: '', thumbnail: '', body_html: '', pinned: false, published_at: ''
};

export function messageMain(title, message) {
  return `<section class="a-card a-narrow"><h1>${esc(title)}</h1><p>${esc(message)}</p><p><a href="/admin">기사 목록으로</a></p></section>`;
}
