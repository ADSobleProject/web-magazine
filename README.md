# 웹 매거진

메인·카테고리·기사 상세 페이지와 기사 관리자 화면. 요구사항 명세와 화면 시안은 내부 문서라 저장소에 포함하지 않는다(로컬 `docs/`).

## 실행

```bash
npm install
npm start              # http://localhost:3000
npm test
npm run admin:create   # 관리자 계정 추가 (비밀번호는 화면에 표시되지 않음)
```

로컬에서는 설정 없이 바로 돌아간다. DB는 `data/pglite`(PGlite, 프로그램 안에서 도는 Postgres), 업로드 이미지는 `uploads/`에 저장된다. 둘 다 git에 올라가지 않는다.
첫 실행 때 샘플 기사 60건과 영상 10건이 한 번 들어간다.

환경 변수 ([.env.example](.env.example) 참고)

| 이름 | 설명 |
| --- | --- |
| `PORT` | 서버 포트 (기본 3000) |
| `SITE_ORIGIN` | 정식 주소. 다른 호스트로 들어온 요청을 301로 이동시키고 canonical·공유 주소에 쓴다. |
| `DATABASE_URL` | Postgres 접속 주소(Neon). 운영에서는 필수. 없으면 로컬 PGlite를 쓴다. |
| `CLOUDINARY_URL` | 이미지 저장소. 운영에서 없으면 이미지 업로드가 503으로 거절된다. |
| `ADMIN_SETUP_TOKEN` | 첫 관리자 만들기(`/admin/setup`)용 일회용 코드, 16자 이상. 관리자가 한 명이라도 있으면 화면이 닫힌다. |

## 관리자 화면 (`/admin`)

- 처음: `ADMIN_SETUP_TOKEN`을 설정하고 `/admin/setup`에서 첫 관리자를 만든다. 이후 관리자는 `npm run admin:create`로 추가한다.
- 역할: `admin`(전체), `editor`(기사 작성·수정만, 백업·샘플 삭제 불가).
- 기사: 워드형 편집기(Quill)로 작성, 임시저장·게시·예약 게시(게시 시각을 미래로), 기획 탭 고정, 미리보기, 삭제.
- 관리 도구: 전체 기사 백업(JSON 내려받기), 샘플 기사 일괄 삭제.
- 보안: 비밀번호 scrypt 해시, 세션 쿠키 HttpOnly·SameSite=Lax(운영은 Secure, `__Host-` 접두사), 로그인 10분에 5회 실패 시 잠금,
  CSRF 토큰 + 출처 확인, 본문 HTML은 저장·출력 때 허용 목록으로 정리(sanitize-html), 업로드는 파일 내용으로 형식 확인(SVG 불가, 5MB 이하).

## 배포 (Render)

[render.yaml](render.yaml)에 설정이 있다. `main`에 올릴 때마다 자동 배포된다.
Environment에 `SITE_ORIGIN`, `DATABASE_URL`, `CLOUDINARY_URL`, `ADMIN_SETUP_TOKEN`을 넣는다.
무료 요금제는 15분간 접속이 없으면 잠들어 다음 첫 접속이 느리다. Neon 무료 DB는 복원 가능 기간이 짧으니 관리자 화면의 백업을 주기적으로 받아 둔다.

## 구조

```
src/
  server.js              서버 시작 (DB 연결, 구조 변경 적용)
  app.js                 미들웨어와 라우터 연결
  config.js              브랜드명, 문구, 외부 주소
  middleware.js          보안 헤더, 정식 주소 이동
  db/                    DB 연결(Postgres/PGlite), 구조 변경 기록(migrations)
  auth/                  비밀번호, 계정·세션, 로그인 제한, 로그인·CSRF 확인
  admin/articleForm.js   기사 입력 검사
  data/repository.js     공개 화면 조회 규칙 (개수, 정렬, 이어받기, 공개 조건)
  data/adminRepository.js 관리자용 조회·저장
  data/categories.js     카테고리와 세부 분류
  data/seed.js           샘플 데이터
  routes/                페이지, 데이터 API, 관리자, 썸네일
  views/                 공개 화면·관리자 화면 HTML (서버 렌더링)
  lib/                   위치값, HTML 안전 처리, 본문 정리, 이미지 저장, 시간 표시
public/
  css/site.css, css/admin.css
  js/main.js             공개 화면 코드 진입점
  js/admin/              편집기, 삭제 확인
scripts/create-admin.js  관리자 계정 추가
test/                    node:test + jsdom + PGlite
```

## 주소

| 주소 | 내용 |
| --- | --- |
| `/` | 메인 |
| `/category/{카테고리}?sub={세부 분류}` | 카테고리 목록 |
| `/article/{번호}-{영문 요약}` | 기사 상세 |
| `/info/{about,ethics,grievance,privacy}` | 회사 정보 (준비 중) |
| `/admin` | 관리자 화면 |

## 데이터 API

| 주소 | 응답 |
| --- | --- |
| `GET /api/articles/latest[?cursor=]` | 첫 요청 20건, 이후 6건씩. `{ items, nextCursor }` |
| `GET /api/articles/{popular,featured,rising}` | 5건 `{ items }` |
| `GET /api/categories` | 카테고리 목록 |
| `GET /api/categories/{이름}/articles[?sub=&cursor=]` | 첫 요청 `{ featured(2), items(6), nextCursor }`, 이후 `{ items(6), nextCursor }` |
| `GET /api/videos` | 10건 |
| `GET /api/banners` | 메인 상단 배너 |

`nextCursor`가 `null`이면 마지막이다. 임시저장·예약 기사는 어떤 API에도 나오지 않는다.
