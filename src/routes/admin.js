// 관리자 화면(/admin). 로그인·첫 관리자 설정을 빼면 모두 로그인과 CSRF 확인을 거친다.
import { timingSafeEqual } from 'node:crypto';
import express, { Router } from 'express';
import multer from 'multer';
import { readArticleForm } from '../admin/articleForm.js';
import { checkPasswordRule } from '../auth/password.js';
import { normalizeEmail } from '../auth/users.js';
import {
  clearSessionCookie, loadSession, readSessionToken, requireCsrf, requireLogin, setSessionCookie
} from '../auth/middleware.js';
import { detectImage, MAX_IMAGE_BYTES, StorageUnavailableError } from '../lib/images.js';
import {
  adminLayout, editMain, EMPTY_FORM, formFromArticle, listMain, loginMain, messageMain, setupMain
} from '../views/admin.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_SETUP_TOKEN = 16;

function sameSecret(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

// 로그인·설정 폼은 세션이 생기기 전이라 CSRF 토큰이 없다. 대신 같은 사이트에서 보낸 요청인지 확인한다.
function sameOrigin(req) {
  const self = `${req.protocol}://${req.get('host')}`;
  const origin = req.get('origin');
  if (origin) return origin === self;
  const referer = req.get('referer');
  return Boolean(referer) && (referer === self || referer.startsWith(`${self}/`));
}

const requireRole = (role) => (req, res, next) => (
  req.user.role === role ? next() : res.status(403).type('html').send(adminLayout({
    title: '권한 없음', user: req.user, csrf: req.csrf, main: messageMain('권한 없음', '이 기능은 관리자만 쓸 수 있습니다.')
  }))
);

const parseId = (value) => (/^\d{1,9}$/.test(value) ? Number(value) : null);

export function adminRouter({ users, adminRepo, publicRepo, limiter, imageStore, setupToken, now, renderPreview }) {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 5 } });

  router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    next();
  });
  router.use(express.urlencoded({ extended: false, limit: '1mb', parameterLimit: 50 }));
  router.use(loadSession(users));

  const page = (req, res, opts, status = 200) =>
    res.status(status).type('html').send(adminLayout({ user: req.user, csrf: req.csrf, ...opts }));

  const setupOpen = async () => Boolean(setupToken && setupToken.length >= MIN_SETUP_TOKEN) && (await users.count()) === 0;

  /* ---------- 로그인 ---------- */
  router.get('/login', async (req, res) => {
    if (req.user) return res.redirect(303, '/admin');
    page(req, res, { title: '로그인', main: loginMain({ setupAvailable: await setupOpen() }) });
  });

  router.post('/login', async (req, res) => {
    if (!sameOrigin(req)) return res.status(403).type('text').send('다른 사이트에서 보낸 요청은 처리하지 않습니다.');
    const email = normalizeEmail(req.body.email);
    const keys = [`ip:${req.ip}`, `email:${email}`];
    const fail = (message, status) => page(req, res, { title: '로그인', main: loginMain({ email, error: message }) }, status);

    const wait = limiter.blockedFor(keys);
    if (wait > 0) {
      return fail(`로그인 시도가 너무 많습니다. ${Math.ceil(wait / 60)}분 뒤에 다시 시도하세요.`, 429);
    }
    const user = await users.authenticate(email, req.body.password);
    if (!user) {
      limiter.fail(keys);
      return fail('이메일 또는 비밀번호가 맞지 않습니다.', 401);
    }
    limiter.reset(keys);
    const { token } = await users.startSession(user.id);
    setSessionCookie(res, token);
    res.redirect(303, '/admin');
  });

  router.post('/logout', requireLogin, requireCsrf, async (req, res) => {
    await users.endSession(readSessionToken(req));
    clearSessionCookie(res);
    res.redirect(303, '/admin/login');
  });

  /* ---------- 첫 관리자 만들기 ---------- */
  router.get('/setup', async (req, res, next) => {
    if (!(await setupOpen())) return next();
    page(req, res, { title: '첫 관리자 만들기', main: setupMain({}) });
  });

  router.post('/setup', async (req, res, next) => {
    if (!(await setupOpen())) return next();
    if (!sameOrigin(req)) return res.status(403).type('text').send('다른 사이트에서 보낸 요청은 처리하지 않습니다.');
    const keys = [`ip:${req.ip}`, 'setup'];
    const form = { name: String(req.body.name ?? '').trim(), email: normalizeEmail(req.body.email) };
    const errors = {};
    if (limiter.blockedFor(keys) > 0) errors.form = '시도가 너무 많습니다. 잠시 뒤에 다시 시도하세요.';
    else if (!sameSecret(req.body.token, setupToken)) {
      limiter.fail(keys);
      errors.token = '설정 코드가 맞지 않습니다.';
    }
    if (!form.name || form.name.length > 50) errors.name = '이름을 50자 이하로 입력하세요.';
    if (!EMAIL.test(form.email)) errors.email = '이메일 형식이 올바르지 않습니다.';
    const pwError = checkPasswordRule(req.body.password);
    if (pwError) errors.password = pwError;
    else if (req.body.password !== req.body.password2) errors.password = '비밀번호 확인이 일치하지 않습니다.';
    if (Object.keys(errors).length) {
      return page(req, res, { title: '첫 관리자 만들기', main: setupMain({ form, errors }) }, 400);
    }

    const user = await users.createFirstAdmin({ ...form, password: req.body.password });
    if (!user) return res.redirect(303, '/admin/login');
    limiter.reset(keys);
    const { token } = await users.startSession(user.id);
    setSessionCookie(res, token);
    res.redirect(303, '/admin');
  });

  /* ---------- 여기부터 로그인 필요 ---------- */
  router.use(requireLogin, requireCsrf);

  router.get('/', async (req, res) => {
    const status = ['published', 'scheduled', 'draft'].includes(req.query.status) ? req.query.status : null;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const pageNo = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
    const [result, counts] = await Promise.all([adminRepo.list({ status, q, page: pageNo }), adminRepo.counts()]);
    const notice = { deleted: '기사를 삭제했습니다.', samples: '샘플 기사를 모두 삭제했습니다.' }[req.query.done] || '';
    page(req, res, { title: '기사 목록', main: listMain({ result, counts, status, q, csrf: req.csrf, notice }) });
  });

  const editorAssets = {
    head: '<link rel="stylesheet" href="/vendor/quill/quill.snow.css">',
    scripts: '<script src="/vendor/quill/quill.js"></script>\n<script type="module" src="/js/admin/editor.js"></script>'
  };
  const editPage = (req, res, opts, status) =>
    page(req, res, { ...editorAssets, title: opts.article ? '기사 수정' : '새 기사', main: editMain({ csrf: req.csrf, ...opts }) }, status);

  router.get('/articles/new', (req, res) => editPage(req, res, { form: EMPTY_FORM }));

  router.post('/articles', async (req, res) => {
    const { form, errors, values } = readArticleForm(req.body, { now: now() });
    if (Object.keys(errors).length) return editPage(req, res, { form, errors }, 400);
    const id = await adminRepo.create(values, req.user.id);
    res.redirect(303, `/admin/articles/${id}?saved=1`);
  });

  router.get('/articles/:id', async (req, res, next) => {
    const id = parseId(req.params.id);
    const article = id && (await adminRepo.get(id));
    if (!article) return next();
    editPage(req, res, { article, form: formFromArticle(article), notice: req.query.saved ? '저장했습니다.' : '' });
  });

  router.post('/articles/:id', async (req, res, next) => {
    const id = parseId(req.params.id);
    const article = id && (await adminRepo.get(id));
    if (!article) return next();
    const { form, errors, values } = readArticleForm(req.body, { now: now(), current: article });
    if (Object.keys(errors).length) return editPage(req, res, { article, form, errors }, 400);
    await adminRepo.update(id, values);
    res.redirect(303, `/admin/articles/${id}?saved=1`);
  });

  router.post('/articles/:id/delete', async (req, res, next) => {
    const id = parseId(req.params.id);
    if (!id || !(await adminRepo.remove(id))) return next();
    res.redirect(303, '/admin?done=deleted');
  });

  // 임시저장·예약 기사도 공개 화면 모양 그대로 볼 수 있다.
  router.get('/articles/:id/preview', async (req, res, next) => {
    const id = parseId(req.params.id);
    const article = id && (await adminRepo.get(id));
    if (!article) return next();
    renderPreview(req, res, article);
  });

  router.post('/samples/delete', requireRole('admin'), async (req, res) => {
    await adminRepo.removeSamples();
    res.redirect(303, '/admin?done=samples');
  });

  router.get('/export', requireRole('admin'), async (req, res) => {
    const day = new Date(now().getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    res.set('Content-Disposition', `attachment; filename="articles-${day}.json"`)
      .type('application/json')
      .send(JSON.stringify({ exportedAt: now().toISOString(), articles: await adminRepo.exportAll() }, null, 2));
  });

  /* ---------- 이미지 업로드 ---------- */
  router.post('/api/uploads', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'too_large', message: '5MB 이하 이미지만 올릴 수 있습니다.' });
      if (err) return res.status(400).json({ error: 'bad_upload', message: '업로드 형식이 올바르지 않습니다.' });
      next();
    });
  }, async (req, res) => {
    const type = detectImage(req.file?.buffer);
    if (!type) return res.status(415).json({ error: 'unsupported', message: 'JPG, PNG, WEBP, GIF 이미지만 올릴 수 있습니다.' });
    try {
      res.status(201).json({ url: await imageStore.save(req.file.buffer, type) });
    } catch (err) {
      if (err instanceof StorageUnavailableError) return res.status(503).json({ error: 'storage_unavailable', message: err.message });
      console.error(err);
      res.status(502).json({ error: 'upload_failed', message: '이미지를 저장하지 못했습니다. 잠시 후 다시 시도하세요.' });
    }
  });

  router.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' });
    page(req, res, { title: '찾을 수 없음', main: messageMain('찾을 수 없는 페이지', '없는 기사이거나 이미 삭제되었습니다.') }, 404);
  });

  return router;
}
