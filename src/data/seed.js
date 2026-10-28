// 시안의 가상 콘텐츠를 옮긴 샘플 데이터. 실제 서비스에서는 DB 조회로 대체한다.
export const CATEGORIES = [
  { key: 'fashion', name: '패션', subs: ['컬렉션', '스타일', '트렌드'] },
  { key: 'beauty', name: '뷰티', subs: ['스킨케어', '메이크업', '향'] },
  { key: 'food', name: '푸드', subs: ['레시피', '맛집', '음료'] },
  { key: 'life', name: '라이프', subs: ['공간', '건강', '관계'] },
  { key: 'tech', name: '테크', subs: ['기기', '서비스', '인공지능'] },
  { key: 'culture', name: '컬처', subs: ['영화', '음악', '전시'] }
];

// 형식: 세부 분류 번호|제목|보조 문장|주소용 영문 요약 이름
const RAW = {
  fashion: [
    '0|오버사이즈 코트의 어깨선이 달라졌다|올겨울 실루엣을 정하는 세 가지 선|oversized-coat-shoulder-line',
    '0|검정 한 벌로 완성한 가을 룩북|소재만 바꿔 입는 모노크롬 스타일링|black-monochrome-lookbook',
    '1|가방 하나로 코디를 바꾸는 법|크기와 끈 길이가 만드는 인상 차이|change-outfit-with-one-bag',
    '1|출근길 니트, 이렇게 입으면 달라 보인다|색 대신 질감으로 차이를 주는 방법|office-knit-styling',
    '2|운동화가 다시 얇아지는 이유|두툼한 밑창 다음에 오는 흐름|thin-sneakers-return',
    '2|빈티지 시계를 고르는 다섯 가지 기준|상태와 이력, 어디까지 확인할까|vintage-watch-buying-guide',
    '0|한 장짜리 스카프로 만든 겨울 포인트|매듭 네 가지를 순서대로 따라 해 보자|winter-scarf-knots',
    '1|청바지 세탁, 얼마나 자주 해야 할까|색 빠짐을 줄이는 관리 습관|how-often-wash-jeans',
    '2|올해의 포인트 컬러는 빨강이었다|거리에서 가장 많이 보인 색|red-color-of-the-year',
    '0|작은 브랜드가 만든 한정 협업 컬렉션|수량이 적을수록 사연은 길어진다|small-brand-limited-collab'
  ],
  beauty: [
    '0|겨울철 각질 관리, 덜어내는 순서가 핵심|제품을 줄여도 결과가 좋아지는 이유|winter-exfoliation-order',
    '0|선크림을 겨울에도 발라야 하는 이유|자외선 지수보다 중요한 것|winter-sunscreen',
    '1|립 하나로 끝내는 5분 메이크업|색 선택부터 바르는 순서까지|five-minute-lip-makeup',
    '1|매트와 글로우 사이, 베이스 고르는 법|피부 결에 맞춘 질감 기준|matte-vs-glow-base',
    '2|향수 첫인상은 15분 뒤에 달라진다|탑노트와 베이스노트 읽는 법|perfume-first-15-minutes',
    '2|겨울 공기에 어울리는 우디 계열 향|무겁지 않게 쓰는 세 가지 방법|woody-scents-for-winter',
    '0|세안 후 3분, 보습 타이밍의 과학|물기가 마르기 전에 해야 할 일|moisturize-after-cleansing',
    '1|눈썹 결을 살리는 가장 쉬운 방법|도구 두 개면 충분하다|natural-brow-grooming',
    '2|좋아하는 향을 오래 두고 쓰는 보관법|빛과 온도에서 지켜 내기|perfume-storage-tips',
    '0|민감한 피부를 위한 성분표 읽기|이름이 길수록 어려운 걸까|ingredient-list-sensitive-skin'
  ],
  food: [
    '0|냉장고 속 재료로 만드는 15분 저녁|프라이팬 하나로 끝나는 세 가지|fifteen-minute-fridge-dinner',
    '0|계란을 가장 부드럽게 익히는 온도|초 단위로 달라지는 식감|softest-egg-temperature',
    '1|골목 끝 작은 식당이 줄 서는 이유|메뉴 세 개로 버티는 가게의 계산|small-restaurant-queue',
    '1|혼밥하기 좋은 카운터 식당 고르는 법|자리 배치에서 보이는 배려|counter-seat-solo-dining',
    '2|집에서 내리는 커피, 물 온도가 전부일까|세 가지 온도로 비교해 봤다|home-coffee-water-temperature',
    '2|겨울에 더 맛있는 차 우리는 법|시간과 양, 두 가지만 기억하자|winter-tea-brewing',
    '0|남은 밥으로 만드는 바삭한 한 끼|수분을 날리는 순서가 관건|crispy-leftover-rice',
    '1|디저트 가게가 메뉴를 줄이는 이유|적게 파는 가게의 새로운 전략|dessert-shop-short-menu',
    '2|탄산수 한 잔으로 바뀌는 저녁 식탁|단맛 없이 즐기는 음료 조합|sparkling-water-pairings',
    '0|국물 요리가 하루 지나 더 맛있는 이유|맛이 섞이는 시간의 비밀|why-soup-tastes-better-next-day'
  ],
  life: [
    '0|작은 방을 넓어 보이게 만드는 정리법|가구를 옮기기 전에 할 일|small-room-organizing',
    '0|조명 하나로 바꾸는 저녁 분위기|밝기보다 위치가 중요하다|lighting-evening-mood',
    '1|아침 10분 스트레칭이 남기는 변화|무리 없이 이어 가는 루틴|morning-stretching',
    '1|잠들기 전 한 시간을 설계하는 방법|화면을 끄는 것만으로 충분할까|bedtime-hour-routine',
    '2|이사 후 첫 달, 이웃과 가까워지는 법|인사 한마디의 효과|meeting-new-neighbors',
    '2|거절을 잘하는 사람들의 말투|관계를 지키며 선을 긋는 세 문장|saying-no-politely',
    '0|식물이 잘 사는 집의 공통점|햇빛보다 먼저 봐야 할 것|homes-where-plants-thrive',
    '1|걷기를 오래 하게 만드는 작은 장치|목표 대신 정해 둘 것|keep-walking-habit',
    '2|오랜 친구와 다시 연락하는 방법|어색함을 줄이는 첫 메시지|reconnect-old-friends',
    '0|계절이 바뀔 때 옷장 정리의 순서|꺼내기 전에 버릴 것부터|seasonal-closet-cleanup'
  ],
  tech: [
    '0|노트북 배터리를 오래 쓰는 설정 다섯 가지|사소한 옵션이 만드는 한 시간|laptop-battery-settings',
    '0|이어폰 노이즈 캔슬링, 어디까지 믿어도 될까|환경별로 비교한 체감 차이|noise-cancelling-limits',
    '1|구독 서비스를 정리하는 가장 쉬운 방법|한 달에 한 번 확인할 것|cleanup-subscriptions',
    '1|메신저 알림을 줄여 집중력을 지키는 법|꼭 필요한 알림만 남기는 기준|reduce-messenger-notifications',
    '2|인공지능 비서에게 일을 맡길 때의 요령|질문보다 중요한 맥락 전달|delegating-to-ai-assistant',
    '2|인공지능이 쓴 글, 어디까지 확인해야 하나|사실 확인의 세 단계|fact-checking-ai-writing',
    '0|스마트폰 저장공간이 자꾸 부족한 이유|보이지 않는 파일의 정체|phone-storage-full',
    '1|비밀번호 관리, 이제 그만 미루자|하나씩 바꾸는 현실적인 순서|password-manager-start',
    '2|회의록을 자동으로 정리하는 작은 습관|도구보다 먼저 정할 것|auto-meeting-notes-habit',
    '0|모니터 높이 하나로 달라지는 어깨 통증|세팅을 바꾸는 5분|monitor-height-shoulder-pain'
  ],
  culture: [
    '0|조용한 영화가 오래 기억에 남는 이유|대사보다 긴 침묵|quiet-films-stay-with-you',
    '0|올해 극장에서 다시 보고 싶은 장면들|한 컷으로 기억되는 영화|scenes-to-rewatch-this-year',
    '1|가사 없이 듣는 연주곡 입문 가이드|처음 듣는 사람을 위한 다섯 곡|instrumental-music-starter',
    '1|공연장에서 소리가 좋은 자리 고르는 법|좌석 배치도 읽는 요령|best-concert-seats',
    '2|작은 전시를 깊게 보는 한 시간 코스|작품 앞에 오래 서 있는 방법|one-hour-small-exhibition',
    '2|사진전에서 놓치기 쉬운 것들|캡션을 먼저 읽어야 하는 이유|photo-exhibition-tips',
    '0|엔딩 크레딧까지 앉아 있어야 하는 영화|끝나고 나서야 보이는 것들|stay-for-end-credits',
    '1|새벽에 듣기 좋은 앨범을 고르는 기준|볼륨보다 중요한 질감|late-night-albums',
    '2|미술관 굿즈, 사도 후회하지 않는 것|전시를 집으로 가져오는 법|museum-goods-worth-buying',
    '0|독립영화 상영관을 찾아가는 길|검색으로 찾기 힘든 작은 극장|finding-indie-cinemas'
  ]
};

// [제목, 길이(초)]
const VIDEOS = [
  ['코트 어깨선 고르는 법 30초 정리', 30], ['립 한 가지로 끝내는 출근 메이크업', 45],
  ['계란 부드럽게 익히는 순간', 38], ['방 정리 전후, 달라진 것은 하나', 27],
  ['노트북 배터리 설정 다섯 가지', 52], ['조용한 영화 한 장면 읽기', 41],
  ['겨울 향수 뿌리는 위치', 33], ['카운터 식당 자리 고르기', 36],
  ['조명 위치만 바꿔 본 거실', 29], ['전시 보는 순서 바꿔 보기', 48]
];

const MINUTE = 60 * 1000;

// now 기준으로 게시 시각을 만든다. 테스트에서는 고정된 now를 넘겨 결과를 일정하게 한다.
export function buildSeed(now = Date.now()) {
  const articles = [];
  CATEGORIES.forEach((cat, k) => {
    RAW[cat.key].forEach((line, j) => {
      const [subIdx, title, deck, slug] = line.split('|');
      const n = j * CATEGORIES.length + k;
      const ageMinutes = 25 + n * 113 + (n % 7) * 17;
      articles.push({
        id: 100 + n,
        slug,
        title,
        deck,
        category: cat.name,
        sub: cat.subs[Number(subIdx)],
        views: 1200 + ((n * 7919) % 9100),
        publishedAt: now - ageMinutes * MINUTE,
        thumbnail: `/img/thumb/${n}.svg`,
        pinned: n % 7 === 3
      });
    });
  });

  const videos = VIDEOS.map(([title, duration], i) => ({
    id: i + 1,
    title,
    duration,
    publishedAt: now - (i + 1) * 180 * MINUTE,
    thumbnail: `/img/thumb/${i * 5 + 2}.svg`,
    // 외부 영상 서비스 주소 자리. 실제 영상 식별자로 바꿔야 한다.
    url: `https://video.example.com/shorts/v${i + 1}`
  }));

  return { categories: CATEGORIES, articles, videos, banners: [] };
}
