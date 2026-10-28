// 비밀번호는 원래 값으로 되돌릴 수 없는 scrypt 해시로만 저장한다.
// 저장 형식: scrypt$N$r$p$소금$해시 (설정을 바꿔도 예전 해시를 확인할 수 있게 값을 같이 남긴다)
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 64 * 1024 * 1024;

export const PASSWORD_RULE = { min: 10, max: 200 };

export function checkPasswordRule(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_RULE.min) {
    return `비밀번호는 ${PASSWORD_RULE.min}자 이상이어야 합니다.`;
  }
  if (password.length > PASSWORD_RULE.max) return `비밀번호는 ${PASSWORD_RULE.max}자 이하여야 합니다.`;
  return null;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAX_MEM });
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const [kind, n, r, p, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: MAX_MEM
  });
  return timingSafeEqual(actual, expected);
}

// 없는 계정으로 로그인할 때도 같은 시간이 걸리게 해, 응답 시간으로 계정 존재 여부를 알아내지 못하게 한다.
let dummyHash;
export async function burnTime(password) {
  dummyHash ??= await hashPassword('dummy-password-for-timing');
  await verifyPassword(String(password ?? ''), dummyHash);
}
