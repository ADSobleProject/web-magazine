// DB 연결. DATABASE_URL이 있으면 Postgres(Neon 등)에, 없으면 PGlite(프로그램 안에서 도는 Postgres)에 붙는다.
// 두 경우 모두 같은 모양으로 쓴다.
//   query(text, params) → { rows }   매개변수가 있는 SQL 한 문장
//   exec(sql)                         매개변수 없는 SQL 여러 문장(테이블 생성 등)
//   transaction(fn)                   fn(tx) 안의 query/exec를 한 트랜잭션으로 묶는다
import { mkdirSync } from 'node:fs';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

// count(*) 같은 bigint를 숫자로 받는다.
pg.types.setTypeParser(20, (v) => Number(v));

export async function createDb({ url = process.env.DATABASE_URL, dataDir } = {}) {
  if (url) {
    const pool = new pg.Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30000 });
    return {
      kind: 'postgres',
      query: (text, params) => pool.query(text, params),
      exec: (sql) => pool.query(sql),
      async transaction(fn) {
        const client = await pool.connect();
        const tx = { query: (t, p) => client.query(t, p), exec: (s) => client.query(s) };
        try {
          await client.query('BEGIN');
          const result = await fn(tx);
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
      close: () => pool.end()
    };
  }

  // dataDir이 없으면 메모리에만 둔다(테스트용). PGlite는 상위 폴더를 만들지 않으므로 먼저 만든다.
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const lite = new PGlite(dataDir);
  await lite.waitReady;
  return {
    kind: 'pglite',
    query: (text, params) => lite.query(text, params),
    exec: (sql) => lite.exec(sql),
    transaction: (fn) => lite.transaction((tx) => fn({
      query: (t, p) => tx.query(t, p),
      exec: (s) => tx.exec(s)
    })),
    close: () => lite.close()
  };
}
