// 관리자 화면용 조회·저장. 공개 화면과 달리 임시저장·예약 기사도 다룬다.
export const ADMIN_PAGE_SIZE = 30;

// 목록 필터: 게시됨 / 예약(게시 시각이 미래) / 임시저장
const STATUS_WHERE = {
  published: "status = 'published' AND published_at <= $1",
  scheduled: "status = 'published' AND published_at > $1",
  draft: "status = 'draft'"
};

export function articleState(row, now) {
  if (row.status === 'draft') return 'draft';
  return row.published_at > now ? 'scheduled' : 'published';
}

const FIELDS = ['slug', 'title', 'deck', 'body_html', 'category', 'sub', 'thumbnail', 'status', 'pinned', 'published_at'];

export function createAdminRepository(db, { now = () => new Date() } = {}) {
  return {
    async counts() {
      const { rows } = await db.query(
        `SELECT count(*)::int AS all,
                count(*) FILTER (WHERE ${STATUS_WHERE.published})::int AS published,
                count(*) FILTER (WHERE ${STATUS_WHERE.scheduled})::int AS scheduled,
                count(*) FILTER (WHERE ${STATUS_WHERE.draft})::int AS draft,
                count(*) FILTER (WHERE is_sample)::int AS samples
         FROM articles`, [now()]);
      return rows[0];
    },

    async list({ status = null, q = '', page = 1 } = {}) {
      const values = [];
      const where = [];
      if (STATUS_WHERE[status]) {
        // 상태 조건은 $1(지금 시각)을 쓴다. 쓰지 않는 매개변수를 넘기면 Postgres가 오류를 내므로 필요할 때만 넣는다.
        values.push(now());
        where.push(STATUS_WHERE[status]);
      }
      if (q) {
        values.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
        where.push(`title ILIKE $${values.length}`);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = (await db.query(`SELECT count(*)::int AS n FROM articles ${whereSql}`, values)).rows[0].n;
      values.push(ADMIN_PAGE_SIZE, (page - 1) * ADMIN_PAGE_SIZE);
      const { rows } = await db.query(
        `SELECT id, slug, title, category, sub, status, pinned, views, published_at, updated_at, is_sample
         FROM articles ${whereSql}
         ORDER BY COALESCE(published_at, updated_at) DESC, id DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
      return {
        items: rows.map((r) => ({ ...r, state: articleState(r, now()) })),
        total,
        page,
        pages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE))
      };
    },

    async get(id) {
      const { rows } = await db.query('SELECT * FROM articles WHERE id = $1', [id]);
      return rows[0] ? { ...rows[0], state: articleState(rows[0], now()) } : null;
    },

    async create(values, authorId) {
      const cols = [...FIELDS, 'author_id'];
      const params = [...FIELDS.map((f) => values[f]), authorId];
      const { rows } = await db.query(
        `INSERT INTO articles (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
        params);
      return rows[0].id;
    },

    async update(id, values) {
      const sets = FIELDS.map((f, i) => `${f} = $${i + 1}`).join(', ');
      const { rowCount } = await db.query(
        `UPDATE articles SET ${sets}, updated_at = now() WHERE id = $${FIELDS.length + 1}`,
        [...FIELDS.map((f) => values[f]), id]);
      return rowCount > 0;
    },

    async remove(id) {
      const { rowCount } = await db.query('DELETE FROM articles WHERE id = $1', [id]);
      return rowCount > 0;
    },

    async removeSamples() {
      const { rowCount } = await db.query('DELETE FROM articles WHERE is_sample');
      return rowCount;
    },

    // 백업용 전체 내보내기
    async exportAll() {
      const { rows } = await db.query(
        `SELECT id, slug, title, deck, body_html, category, sub, thumbnail, status, pinned, views,
                published_at, created_at, updated_at, is_sample
         FROM articles ORDER BY id`);
      return rows;
    }
  };
}
