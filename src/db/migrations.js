// DB 구조 변경 기록. 번호 순서대로 한 번씩만 실행되고, 실행한 번호는 schema_migrations에 남는다.
// 이미 배포된 단계는 고치지 말고 새 번호로 추가한다.
import { buildSeed } from '../data/seed.js';
import { esc } from '../lib/html.js';

const MIGRATIONS = [
  {
    version: 1,
    name: '기본 테이블',
    up: (db) => db.exec(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'editor')),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        csrf TEXT NOT NULL,
        expires_at TIMESTAMPTZ(3) NOT NULL,
        created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
      );

      CREATE TABLE articles (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
        title TEXT NOT NULL,
        deck TEXT NOT NULL DEFAULT '',
        body_html TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL,
        sub TEXT,
        thumbnail TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
        pinned BOOLEAN NOT NULL DEFAULT FALSE,
        views INT NOT NULL DEFAULT 0,
        published_at TIMESTAMPTZ(3),
        author_id INT REFERENCES users(id) ON DELETE SET NULL,
        is_sample BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
      );
      CREATE INDEX articles_public_idx ON articles (published_at DESC, id DESC) WHERE status = 'published';
      CREATE INDEX articles_category_idx ON articles (category, published_at DESC, id DESC) WHERE status = 'published';

      CREATE TABLE videos (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        duration INT NOT NULL,
        thumbnail TEXT NOT NULL,
        url TEXT NOT NULL,
        published_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
      );

      CREATE TABLE banners (
        id SERIAL PRIMARY KEY,
        position TEXT NOT NULL DEFAULT 'main-top',
        image TEXT NOT NULL,
        alt TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL,
        sort INT NOT NULL DEFAULT 0
      );
    `)
  },
  {
    version: 2,
    name: '샘플 기사와 영상',
    async up(db, { now }) {
      const { articles, videos } = buildSeed(now);
      for (const a of articles) {
        const body = `<p>${esc(a.deck)}.</p><p>이 기사는 화면 확인용 샘플입니다. 관리자 화면의 "샘플 기사 모두 삭제"로 한꺼번에 지울 수 있습니다.</p>`;
        await db.query(
          `INSERT INTO articles (id, slug, title, deck, body_html, category, sub, thumbnail, status, pinned, views, published_at, is_sample)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published', $9, $10, $11, TRUE)`,
          [a.id, a.slug, a.title, a.deck, body, a.category, a.sub, a.thumbnail, a.pinned, a.views, new Date(a.publishedAt)]
        );
      }
      await db.query(`SELECT setval(pg_get_serial_sequence('articles', 'id'), (SELECT max(id) FROM articles))`);
      for (const v of videos) {
        await db.query(
          'INSERT INTO videos (title, duration, thumbnail, url, published_at) VALUES ($1, $2, $3, $4, $5)',
          [v.title, v.duration, v.thumbnail, v.url, new Date(v.publishedAt)]
        );
      }
    }
  }
];

export async function migrate(db, { now = Date.now(), log = () => {} } = {}) {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const { rows } = await db.query('SELECT version FROM schema_migrations');
  const done = new Set(rows.map((r) => r.version));
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    await db.transaction(async (tx) => {
      await m.up(tx, { now });
      await tx.query('INSERT INTO schema_migrations (version) VALUES ($1)', [m.version]);
    });
    log(`DB 변경 ${m.version} 적용: ${m.name}`);
  }
}
