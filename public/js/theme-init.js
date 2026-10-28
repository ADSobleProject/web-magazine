// 쿠키를 쓸 수 없어 서버가 테마를 정하지 못했을 때, 이번 방문에서 고른 테마를 깜빡임 없이 적용한다.
// 화면을 그리기 전에 실행되어야 하므로 head에서 바로 불러오는 일반 스크립트다.
(function () {
  var root = document.documentElement;
  if (root.hasAttribute('data-theme')) return;
  try {
    var t = sessionStorage.getItem('theme');
    if (t === 'dark' || t === 'light') root.setAttribute('data-theme', t);
  } catch (e) {
    // 저장소를 쓸 수 없으면 시스템 기본 테마로 둔다.
  }
})();
