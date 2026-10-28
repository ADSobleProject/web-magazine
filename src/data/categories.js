// 카테고리와 세부 분류. 메뉴 순서는 배열 순서를 따른다. 관리자 화면에서 편집하는 기능은 아직 없다.
export const CATEGORIES = [
  { key: 'fashion', name: '패션', subs: ['컬렉션', '스타일', '트렌드'] },
  { key: 'beauty', name: '뷰티', subs: ['스킨케어', '메이크업', '향'] },
  { key: 'food', name: '푸드', subs: ['레시피', '맛집', '음료'] },
  { key: 'life', name: '라이프', subs: ['공간', '건강', '관계'] },
  { key: 'tech', name: '테크', subs: ['기기', '서비스', '인공지능'] },
  { key: 'culture', name: '컬처', subs: ['영화', '음악', '전시'] }
];

export function findCategory(name) {
  return CATEGORIES.find((c) => c.name === name) || null;
}
