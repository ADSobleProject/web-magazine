// 사이트 공통 설정. 브랜드명, 문구, 외부 주소는 서비스 확정 후 이곳만 바꾸면 된다.
export const SITE = {
  name: '브랜드명',
  description: '읽을수록 선명해지는 하루. 패션, 뷰티, 푸드, 라이프, 테크, 컬처 이야기를 매일 전합니다.',
  // 정식 주소. 설정하면 다른 호스트로 들어온 요청을 이 주소로 301 이동시킨다. 예: https://www.example.com
  origin: process.env.SITE_ORIGIN || '',
  shopUrl: 'https://shop.example.com',
  headerLinks: [{ key: 'about', label: '회사 소개' }],
  footerLinks: [
    { key: 'about', label: '회사 소개' },
    { key: 'ethics', label: '윤리강령' },
    { key: 'grievance', label: '고충 처리' },
    { key: 'privacy', label: '개인정보 처리방침' }
  ],
  company: '회사명, 주소, 대표자, 사업자등록번호, 연락처를 이곳에 입력하세요.'
};
