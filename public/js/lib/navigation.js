// 미리 받기와 스크롤 위치 기억(명세 3장 D, 6장 미리 받기).

// 카테고리 메뉴에 마우스를 올리거나 키보드로 초점을 옮겼을 때 그 화면만 미리 받는다.
// 데이터 절약 모드에서는 미리 받지 않는다.
export function initPrefetch(nav) {
  if (!nav || navigator.connection?.saveData) return;
  const done = new Set();
  const prefetch = (e) => {
    const link = e.target.closest?.('a[href^="/category/"]');
    if (!link || done.has(link.href)) return;
    done.add(link.href);
    const name = decodeURIComponent(new URL(link.href).pathname.split('/')[2] || '');
    for (const href of [link.href, `/api/categories/${encodeURIComponent(name)}/articles`]) {
      const hint = document.createElement('link');
      hint.rel = 'prefetch';
      hint.href = href;
      document.head.append(hint);
    }
  };
  nav.addEventListener('pointerenter', prefetch, true);
  nav.addEventListener('focusin', prefetch);
}

// 떠날 때 스크롤 위치를 브라우저 임시 저장소에 기록하고, 뒤로 가기로 돌아오면 목록이 채워진 뒤 복원한다.
export function initScrollMemory(ready) {
  const key = `scroll:${location.pathname}${location.search}`;
  const nav = performance.getEntriesByType?.('navigation')[0];

  addEventListener('pagehide', () => {
    try {
      sessionStorage.setItem(key, String(Math.round(scrollY)));
    } catch {
      // 저장소를 못 쓰면 기억하지 않는다.
    }
  });

  if (nav?.type !== 'back_forward') return;
  history.scrollRestoration = 'manual';
  Promise.resolve(ready).finally(() => {
    let y = null;
    try {
      y = Number(sessionStorage.getItem(key));
    } catch {
      return;
    }
    if (y > 0) scrollTo(0, y);
  });
}
