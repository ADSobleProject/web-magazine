// data-confirm이 붙은 폼은 보내기 전에 한 번 더 묻는다(삭제 등 되돌릴 수 없는 동작).
// 보안 정책상 HTML 안의 onclick 같은 인라인 스크립트를 쓸 수 없어 여기서 처리한다.
document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-confirm]');
  if (form && !window.confirm(form.dataset.confirm)) e.preventDefault();
});
