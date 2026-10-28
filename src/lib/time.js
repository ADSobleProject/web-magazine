// 서버에서 그리는 날짜는 한국 시간으로 표시한다. 예: 2026. 10. 28. 09:05
export function formatKst(date) {
  if (!date) return '';
  const kst = new Date(new Date(date).getTime() + 9 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${kst.getUTCFullYear()}. ${kst.getUTCMonth() + 1}. ${kst.getUTCDate()}. ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
}
