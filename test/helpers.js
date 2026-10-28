import { createApp } from '../src/app.js';
import { createRepository } from '../src/data/repository.js';
import { buildSeed } from '../src/data/seed.js';

export const NOW = Date.parse('2026-10-28T09:00:00+09:00');

// mutate로 샘플 데이터를 바꿔 특수한 상황(빈 목록, 위험한 제목 등)을 만든다.
export function makeRepo(mutate) {
  const seed = buildSeed(NOW);
  mutate?.(seed);
  return { seed, repo: createRepository(seed, { now: () => NOW }) };
}

export function startServer({ repo = makeRepo().repo, siteOrigin = '' } = {}) {
  const app = createApp({ repo, siteOrigin });
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({
        base: `http://localhost:${server.address().port}`,
        close: () => new Promise((r) => server.close(r))
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
