import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { SITE } from './config.js';
import { securityHeaders, canonicalRedirect } from './middleware.js';
import { apiRouter } from './routes/api.js';
import { imageRouter } from './routes/images.js';
import { pageRouter } from './routes/pages.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function createApp({ repo, siteOrigin = SITE.origin } = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use(securityHeaders);
  app.use(canonicalRedirect(siteOrigin));
  // 파일 이름에 버전이 없으므로 매번 바뀌었는지 확인(ETag)하게 해 배포 직후 옛 파일이 섞이지 않게 한다.
  app.use(express.static(publicDir, { index: false, redirect: false, maxAge: 0 }));
  app.use(imageRouter());
  app.use('/api', apiRouter(repo));
  app.use(pageRouter(repo));

  // 예상하지 못한 오류는 내부 내용을 숨기고 짧은 안내만 보낸다.
  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'server_error' });
    res.status(500).type('text').send('일시적인 오류가 발생했습니다. 잠시 후 다시 시도하세요.');
  });

  return app;
}
