// 다크 모드(명세 3장 E): 즉시 반대 테마로 바꾸고, 선택값을 사이트 전체 쿠키 1개에 저장한다.
// 쿠키를 쓸 수 없으면 이번 방문 동안만 유지한다(sessionStorage, theme-init.js가 읽음).
const ONE_YEAR = 60 * 60 * 24 * 365;

export function currentTheme() {
  const set = document.documentElement.getAttribute('data-theme');
  if (set === 'dark' || set === 'light') return set;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function label(theme) {
  return theme === 'dark' ? '밝은 화면으로 바꾸기' : '어두운 화면으로 바꾸기';
}

export function saveTheme(theme) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `theme=${theme}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${secure}`;
  try {
    sessionStorage.setItem('theme', theme);
  } catch {
    // 저장소도 막혀 있으면 지금 화면에만 적용된다.
  }
}

export function initThemeToggle(button) {
  if (!button) return;
  const sync = () => button.setAttribute('aria-label', label(currentTheme()));
  sync();
  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    saveTheme(next);
    sync();
  });
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', sync);
}
