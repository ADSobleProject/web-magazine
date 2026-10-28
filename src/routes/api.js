// 목록 데이터 API. 메인 화면은 영역마다 따로 요청하므로 한 영역이 실패해도 나머지는 정상 표시된다.
import { Router } from 'express';
import { decodeCursor } from '../lib/cursor.js';

const LIST_CACHE = 'public, max-age=30';

// 위치값이 없으면 undefined, 있는데 형식이 틀리면 null
function readCursor(req) {
  const raw = req.query.cursor;
  if (raw === undefined) return undefined;
  return decodeCursor(raw);
}

export function apiRouter(repo) {
  const router = Router();

  router.use((req, res, next) => {
    res.set('Cache-Control', LIST_CACHE);
    next();
  });

  router.get('/articles/latest', (req, res) => {
    const cursor = readCursor(req);
    if (cursor === null) return res.status(400).json({ error: 'invalid_cursor' });
    res.json(repo.latest(cursor));
  });

  router.get('/articles/popular', (req, res) => res.json({ items: repo.popular() }));
  router.get('/articles/featured', (req, res) => res.json({ items: repo.featured() }));
  router.get('/articles/rising', (req, res) => res.json({ items: repo.rising() }));
  router.get('/categories', (req, res) => res.json({ items: repo.categories() }));
  router.get('/videos', (req, res) => res.json({ items: repo.videos() }));
  router.get('/banners', (req, res) => res.json({ items: repo.banners() }));

  router.get('/categories/:name/articles', (req, res) => {
    const category = repo.findCategory(req.params.name);
    if (!category) return res.status(404).json({ error: 'category_not_found' });

    const { sub } = req.query;
    if (sub !== undefined && (typeof sub !== 'string' || !category.subs.includes(sub))) {
      return res.status(400).json({ error: 'invalid_sub' });
    }
    const cursor = readCursor(req);
    if (cursor === null) return res.status(400).json({ error: 'invalid_cursor' });

    res.json(repo.categoryArticles(category.name, { sub, cursor }));
  });

  router.use((req, res) => {
    res.set('Cache-Control', 'no-store').status(404).json({ error: 'not_found' });
  });

  return router;
}
