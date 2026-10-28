import path from 'node:path';
import { createApp } from './app.js';
import { createDb } from './db/index.js';
import { migrate } from './db/migrations.js';

const port = Number(process.env.PORT) || 3000;
const production = process.env.NODE_ENV === 'production';

// 운영에서 DB 주소가 없으면 PGlite가 서버 디스크에 저장하는데, Render 무료 서버는 다시 켜질 때 디스크가 지워진다.
// 쓴 기사가 사라지지 않게 시작하지 않는다.
if (production && !process.env.DATABASE_URL) {
  console.error('DATABASE_URL이 설정되지 않았습니다. Render의 Environment에 Neon 접속 주소를 넣어 주세요.');
  process.exit(1);
}

const db = await createDb({ dataDir: path.resolve('data/pglite') });
await migrate(db, { log: console.log });
if (db.kind === 'pglite') console.log('로컬 DB(PGlite)를 사용합니다: data/pglite');

createApp({ db }).listen(port, () => {
  console.log(`웹 매거진 서버: http://localhost:${port}`);
});
