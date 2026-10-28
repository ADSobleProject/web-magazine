// 샘플 데이터용 가상 썸네일. 검정, 흰색, 빨강 도형으로 번호마다 다른 그림을 만든다.
// 실제 서비스에서는 이미지 전용 서버의 webp 파일로 바꾼다(명세 4-3).
const R = '#e11d2b';
const K = '#000';
const W = '#fff';
const S = '#efefef';

export function thumbnailSvg(n) {
  const v = n % 8;
  const t = (n * 37) % 100;
  let s = '';
  if (v === 0) {
    s = `<rect width="400" height="300" fill="${R}"/><circle cx="${120 + t * 1.6}" cy="150" r="110" fill="${K}"/><circle cx="${120 + t * 1.6}" cy="150" r="34" fill="${W}"/>`;
  } else if (v === 1) {
    s = `<rect width="400" height="300" fill="${K}"/>`;
    for (let i = 0; i < 8; i++) {
      const h = (i * 53 + n * 17) % 90;
      s += `<rect x="${i * 50 + 14}" y="${30 + h}" width="22" height="${240 - h}" fill="${W}"/>`;
    }
    s += `<circle cx="${60 + t * 2.6}" cy="70" r="36" fill="${R}"/>`;
  } else if (v === 2) {
    s = `<rect width="400" height="300" fill="${S}"/><path d="M0 110A190 190 0 0 1 190 300L0 300Z" fill="${K}"/><rect x="${230 + t}" y="40" width="110" height="110" fill="${R}"/>`;
  } else if (v === 3) {
    s = `<rect width="400" height="300" fill="${K}"/><polygon points="0,230 400,${40 + t} 400,${130 + t} 0,300" fill="${R}"/><line x1="0" y1="60" x2="400" y2="${20 + t * 0.3}" stroke="${W}" stroke-width="3"/>`;
  } else if (v === 4) {
    s = `<rect width="400" height="300" fill="${R}"/>`;
    for (const r of [120, 86, 52]) {
      s += `<circle cx="${170 + t * 0.6}" cy="150" r="${r}" fill="none" stroke="${W}" stroke-width="10"/>`;
    }
    s += `<circle cx="${170 + t * 0.6}" cy="150" r="18" fill="${K}"/>`;
  } else if (v === 5) {
    s = `<rect width="400" height="300" fill="${S}"/>`;
    for (let i = 0; i < 6; i++) {
      s += `<rect x="0" y="${24 + i * 44}" width="${120 + ((i * 71 + n * 29) % 260)}" height="26" fill="${K}"/>`;
    }
    s += `<circle cx="340" cy="${60 + t * 1.8}" r="30" fill="${R}"/>`;
  } else if (v === 6) {
    s = `<rect width="400" height="300" fill="${K}"/>`;
    const hot = n % 54;
    for (let i = 0; i < 54; i++) {
      const on = i === hot;
      s += `<circle cx="${30 + (i % 9) * 42}" cy="${35 + Math.floor(i / 9) * 46}" r="${on ? 14 : 7}" fill="${on ? R : W}"/>`;
    }
  } else {
    s = `<rect width="400" height="300" fill="${S}"/><path d="M0 300A200 200 0 0 1 400 300Z" fill="${R}"/><rect x="${40 + t}" y="60" width="120" height="26" fill="${K}"/><rect x="40" y="40" width="8" height="150" fill="${K}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300" preserveAspectRatio="xMidYMid slice">${s}</svg>`;
}
