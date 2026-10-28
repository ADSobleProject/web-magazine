import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { SITE } from './config.js';
import { securityHeaders, canonicalRedirect } from './middleware.js';
import { createRepository } from './data/repository.js';
import { createAdminRepository } from './data/adminRepository.js';
import { createUsers } from './auth/users.js';
import { createLoginLimiter } from './auth/rateLimit.js';
import { createImageStore } from './lib/images.js';
import { apiRouter } from './routes/api.js';
import { imageRouter } from './routes/images.js';
import { adminRouter } from './routes/admin.js';
import { pageRouter, renderPreview } from './routes/pages.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_UPLOADS_DIR = path.join(root, 'uploads');

export function createApp({
  db,
  now = () => new Date(),
  siteOrigin = SITE.origin,
  setupToken = process.env.ADMIN_SETUP_TOKEN,
  uploadsDir = DEFAULT_UPLOADS_DIR,
  imageStore = createImageStore({ localDir: uploadsDir })
}) {
  const repo = createRepository(db, { now });
  const app = express();
  app.disable('x-powered-by');
  // Render 등 앞단 프록시 뒤에서 돌 때 실제 방문자 IP와 https 여부를 읽는다(로그인 제한, 출처 확인에 필요).
  if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(canonicalRedirect(siteOrigin));
  // 파일 이름에 버전이 없으므로 매번 바뀌었는지 확인(ETag)하게 해 배포 직후 옛 파일이 섞이지 않게 한다.
  app.use(express.static(path.join(root, 'public'), { index: false, redirect: false, maxAge: 0 }));
  // 편집기 파일은 node_modules에서 필요한 두 개만 내보낸다.
  for (const file of ['quill.js', 'quill.snow.css']) {
    app.get(`/vendor/quill/${file}`, (req, res) => res.sendFile(path.join(root, 'node_modules', 'quill', 'dist', file)));
  }
  // 로컬 개발용 업로드 폴더. 운영에서는 Cloudinary를 쓰므로 비어 있다.
  app.use('/uploads', express.static(uploadsDir, { index: false, redirect: false, maxAge: '30d', immutable: true }));
  app.use(imageRouter());
  app.use('/api', apiRouter(repo));
  app.use('/admin', adminRouter({
    users: createUsers(db),
    adminRepo: createAdminRepository(db, { now }),
    publicRepo: repo,
    limiter: createLoginLimiter(),
    imageStore,
    setupToken,
    now,
    renderPreview: renderPreview(repo, now)
  }));
  app.use(pageRouter(repo));

  // 예상하지 못한 오류는 내부 내용을 숨기고 짧은 안내만 보낸다.
  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    if (req.path.startsWith('/api/') || req.path.startsWith('/admin/api/')) {
      return res.status(500).json({ error: 'server_error' });
    }
    res.status(500).type('text').send('일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요.');
  });

  return app;
}
