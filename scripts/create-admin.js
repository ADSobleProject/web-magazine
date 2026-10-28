// 관리자 계정 추가: npm run admin:create
// DATABASE_URL이 있으면 그 DB(Neon 등)에, 없으면 로컬 DB(data/pglite)에 만든다.
// 비밀번호는 화면에 표시하지 않고 입력받는다.
import path from 'node:path';
import readline from 'node:readline';
import { createDb } from '../src/db/index.js';
import { migrate } from '../src/db/migrations.js';
import { createUsers, ROLES } from '../src/auth/users.js';
import { checkPasswordRule } from '../src/auth/password.js';

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // 입력한 글자 대신 아무것도 표시하지 않는다.
      rl._writeToOutput = (text) => { if (text.includes(question)) process.stdout.write(text); };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

const db = await createDb({ dataDir: path.resolve('data/pglite') });
try {
  await migrate(db);
  console.log(`대상 DB: ${db.kind === 'postgres' ? 'DATABASE_URL' : '로컬(data/pglite)'}`);
  const email = await ask('이메일: ');
  const name = await ask('이름: ');
  const role = (await ask(`역할 (${ROLES.join('/')}, 기본 admin): `)) || 'admin';
  const password = await ask('비밀번호: ', { hidden: true });
  const again = await ask('비밀번호 확인: ', { hidden: true });

  const problem = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '이메일 형식이 올바르지 않습니다.'
    : !name ? '이름을 입력하세요.'
    : !ROLES.includes(role) ? `역할은 ${ROLES.join(', ')} 중 하나여야 합니다.`
    : checkPasswordRule(password) || (password !== again ? '비밀번호 확인이 일치하지 않습니다.' : null);
  if (problem) {
    console.error(problem);
    process.exitCode = 1;
  } else {
    const user = await createUsers(db).create({ email, name, password, role });
    console.log(`계정을 만들었습니다: ${user.email} (${user.role})`);
  }
} catch (err) {
  console.error(err.code === '23505' ? '이미 있는 이메일입니다.' : err.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
