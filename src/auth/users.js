// 관리자 계정과 로그인 세션.
// 세션 토큰은 브라우저 쿠키에만 있고, DB에는 그 해시만 저장한다(DB가 유출돼도 세션을 가로챌 수 없게).
import { createHash, randomBytes } from 'node:crypto';
import { burnTime, hashPassword, verifyPassword } from './password.js';

export const SESSION_DAYS = 7;
export const ROLES = ['admin', 'editor'];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function createUsers(db) {
  return {
    async count() {
      const { rows } = await db.query('SELECT count(*)::int AS n FROM users');
      return rows[0].n;
    },

    async create({ email, name, password, role = 'admin' }) {
      if (!ROLES.includes(role)) throw new Error(`알 수 없는 역할: ${role}`);
      const { rows } = await db.query(
        'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
        [normalizeEmail(email), name.trim(), await hashPassword(password), role]);
      return rows[0];
    },

    // 첫 관리자는 관리자가 한 명도 없을 때만 만들 수 있다. 동시에 두 요청이 와도 한 명만 만들어지게 잠근다.
    async createFirstAdmin(input) {
      const passwordHash = await hashPassword(input.password);
      return db.transaction(async (tx) => {
        await tx.exec('LOCK TABLE users IN EXCLUSIVE MODE');
        const { rows } = await tx.query('SELECT count(*)::int AS n FROM users');
        if (rows[0].n > 0) return null;
        const created = await tx.query(
          "INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, 'admin') RETURNING id, email, name, role",
          [normalizeEmail(input.email), input.name.trim(), passwordHash]);
        return created.rows[0];
      });
    },

    // 이메일·비밀번호가 맞고 사용 중인 계정이면 계정 정보를, 아니면 null
    async authenticate(email, password) {
      const { rows } = await db.query(
        'SELECT id, email, name, role, password_hash FROM users WHERE email = $1 AND active', [normalizeEmail(email)]);
      const user = rows[0];
      if (!user) {
        await burnTime(password);
        return null;
      }
      if (!(await verifyPassword(password, user.password_hash))) return null;
      return { id: user.id, email: user.email, name: user.name, role: user.role };
    },

    async startSession(userId) {
      const token = randomBytes(32).toString('base64url');
      const csrf = randomBytes(32).toString('base64url');
      const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
      await db.query('DELETE FROM sessions WHERE expires_at < now()');
      await db.query('INSERT INTO sessions (id, user_id, csrf, expires_at) VALUES ($1, $2, $3, $4)',
        [sha256(token), userId, csrf, expires]);
      return { token, expires };
    },

    async findSession(token) {
      if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
      const { rows } = await db.query(
        `SELECT s.csrf, u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND s.expires_at > now() AND u.active`, [sha256(token)]);
      if (!rows[0]) return null;
      const { csrf, ...user } = rows[0];
      return { user, csrf };
    },

    async endSession(token) {
      if (typeof token === 'string') await db.query('DELETE FROM sessions WHERE id = $1', [sha256(token)]);
    }
  };
}
