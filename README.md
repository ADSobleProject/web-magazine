# 웹 매거진

메인 페이지와 카테고리 목록 페이지. 요구사항 명세와 화면 시안은 내부 문서라 저장소에 포함하지 않는다(로컬 `docs/`).

## 실행

```bash
npm install
npm start        # http://localhost:3000
npm test
```

환경 변수

| 이름 | 설명 |
| --- | --- |
| `PORT` | 서버 포트 (기본 3000) |
| `SITE_ORIGIN` | 정식 주소. 예: `https://www.example.com`. 설정하면 다른 호스트로 들어온 요청을 301로 이동시키고 canonical·공유 주소에 쓴다. |

## 배포 (Render)

[render.yaml](render.yaml)에 설정이 있다. Render 대시보드에서 New → Blueprint로 이 저장소를 연결하면 서비스가 만들어지고, 이후 `main`에 올릴 때마다 자동 배포된다.
서비스가 만들어진 뒤 Environment에서 `SITE_ORIGIN`을 실제 주소(예: `https://web-magazine.onrender.com`)로 입력한다.
무료 요금제는 15분간 접속이 없으면 잠들어 다음 첫 접속이 느리다.

## 구조

```
src/
  server.js            서버 시작
  app.js               미들웨어와 라우터 연결
  config.js            브랜드명, 문구, 외부 주소
  middleware.js        보안 헤더, 정식 주소 이동
  routes/              페이지, 데이터 API, 썸네일
  views/               헤더·푸터 틀과 화면별 본문 (서버 렌더링)
  data/seed.js         샘플 데이터 (DB로 교체 예정)
  data/repository.js   목록별 조회 규칙 (개수, 정렬, 이어받기)
  lib/                 위치값, HTML 안전 처리, 가상 썸네일
public/
  css/site.css
  js/main.js           화면 코드 진입점
  js/pages/            메인, 카테고리
  js/components/       카드, 탭, 더보기, 영역 불러오기
  js/lib/              API 호출, 표시 형식, 테마, 미리 받기
test/                  node:test + jsdom
```

## 주소

| 주소 | 내용 |
| --- | --- |
| `/` | 메인 |
| `/category/{카테고리}?sub={세부 분류}` | 카테고리 목록 |
| `/article/{번호}-{영문 요약}` | 기사 (상세 화면은 준비 중) |
| `/info/{about,ethics,grievance,privacy}` | 회사 정보 (준비 중) |

## 데이터 API

| 주소 | 응답 |
| --- | --- |
| `GET /api/articles/latest[?cursor=]` | 첫 요청 20건, 이후 6건씩. `{ items, nextCursor }` |
| `GET /api/articles/{popular,featured,rising}` | 5건 `{ items }` |
| `GET /api/categories` | 카테고리 목록 |
| `GET /api/categories/{이름}/articles[?sub=&cursor=]` | 첫 요청 `{ featured(2), items(6), nextCursor }`, 이후 `{ items(6), nextCursor }` |
| `GET /api/videos` | 10건 |
| `GET /api/banners` | 메인 상단 배너 |

`nextCursor`가 `null`이면 마지막이다.
