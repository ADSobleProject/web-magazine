import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/index.js';
import { migrate } from '../src/db/migrations.js';
import { createRepository } from '../src/data/repository.js';
import { decodeCursor } from '../src/lib/cursor.js';

export const NOW = Date.parse('2026-10-28T09:00:00+09:00');

// 샘플 데이터가 들어간 메모리 DB. mutate로 특수한 상황(빈 목록, 위험한 제목 등)을 만든다.
export async function makeDb(mutate) {
  const db = await createDb({ url: '' });
  await migrate(db, { now: NOW });
  if (mutate) await mutate(db);
  return db;
}

export function makeRepo(db, now = NOW) {
  return createRepository(db, { now: () => new Date(now) });
}

export const dc = (c) => (c ? decodeCursor(c) : undefined);

export async function startServer({ db, mutate, now = NOW, siteOrigin = '', setupToken = '', imageStore } = {}) {
  const ownDb = !db;
  db ??= await makeDb(mutate);
  const uploadsDir = await mkdtemp(path.join(os.tmpdir(), 'wm-uploads-'));
  const app = createApp({
    db, now: () => new Date(now), siteOrigin, setupToken, uploadsDir,
    ...(imageStore ? { imageStore } : {})
  });
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({
        base: `http://localhost:${server.address().port}`,
        db,
        close: async () => {
          await new Promise((r) => server.close(r));
          if (ownDb) await db.close();
        }
      });
    });
  });
}

export async function waitFor(check, timeout = 3000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('조건을 기다리다 시간이 초과되었습니다.');
    await new Promise((r) => setTimeout(r, 10));
  }
}
