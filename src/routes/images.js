import { Router } from 'express';
import { thumbnailSvg } from '../lib/thumbnail.js';

export function imageRouter() {
  const router = Router();
  router.get('/img/thumb/:n.svg', (req, res, next) => {
    if (!/^\d{1,4}$/.test(req.params.n)) return next();
    res.type('image/svg+xml')
      .set('Cache-Control', 'public, max-age=86400')
      .send(thumbnailSvg(Number(req.params.n)));
  });
  return router;
}
