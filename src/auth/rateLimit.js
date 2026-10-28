// 로그인 실패 제한: 같은 IP 또는 같은 계정으로 10분 안에 5번 틀리면 잠시 막는다.
// 서버 한 대 기준으로 메모리에 기록한다. 서버를 여러 대로 늘리면 DB나 Redis로 옮겨야 한다.
export function createLoginLimiter({ max = 5, windowMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
  const failures = new Map();

  const recent = (key) => {
    const list = (failures.get(key) || []).filter((t) => now() - t < windowMs);
    if (list.length) failures.set(key, list);
    else failures.delete(key);
    return list;
  };

  return {
    // 막혀 있으면 다시 시도할 수 있을 때까지 남은 초, 아니면 0
    blockedFor(keys) {
      let wait = 0;
      for (const key of keys) {
        const list = recent(key);
        if (list.length >= max) wait = Math.max(wait, Math.ceil((list[0] + windowMs - now()) / 1000));
      }
      return wait;
    },
    fail(keys) {
      for (const key of keys) failures.set(key, [...recent(key), now()]);
    },
    reset(keys) {
      for (const key of keys) failures.delete(key);
    }
  };
}
