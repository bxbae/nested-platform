# Nested — 팀 온보딩

코리빙/쉐어하우스 플랫폼. 이 문서는 **클론해서 로컬에서 띄우는 것**까지가 목표입니다.

- 프론트: https://my-zeta-lake.vercel.app
- API: https://nested-platform-production.up.railway.app

---

## 1. 구조

```
nested-platform/
├── coliving/                   Next.js 15 (App Router) — 프론트엔드
│   ├── src/app/                페이지 (파일 = 라우트)
│   ├── src/lib/api/            ★ API 클라이언트 — 프론트↔백 경계
│   ├── src/lib/*.ts            데모 데이터 (data.ts, host.ts, admin.ts …)
│   └── src/components/         공용 컴포넌트
│
└── nested-mono/apps/api/       NestJS — 백엔드
    ├── src/modules/            기능별 모듈 (rooms, auth, messages, admin …)
    ├── prisma/schema.prisma    DB 스키마
    └── docker-compose.yml      로컬 Postgres + Redis
```

**규칙 하나:** 프론트에서 백엔드를 부를 땐 **반드시 `src/lib/api/*`를 거칩니다.**
페이지에서 `fetch()`를 직접 쓰지 마세요. 인증 토큰 첨부·갱신·에러 처리가 거기 모여 있습니다.

---

## 2. 로컬 실행

### 사전 준비
- Node 20+
- Docker (로컬 DB용)

### 백엔드

```bash
cd nested-mono/apps/api
npm install

# Postgres + Redis 띄우기
docker compose up -d

# 환경변수
cp .env.example .env
# → DATABASE_URL, REDIS_URL은 기본값 그대로 두면 docker compose와 맞습니다.
# → JWT_ACCESS_SECRET / JWT_REFRESH_SECRET만 아무 값이나 채우세요.
# → 소셜 로그인·결제·업로드 키는 비워둬도 앱은 뜹니다 (해당 기능만 안 됨).

npx prisma db push     # 스키마를 DB에 반영
npm run seed           # 샘플 데이터 (숙소·유저 등)
npm run start:dev      # → http://localhost:4000
```

### 프론트엔드

```bash
cd coliving
npm install
cp .env.example .env.local
npm run dev            # → http://localhost:3000
```

`.env.local`의 `NEXT_PUBLIC_USE_REAL_API`:
- `true` → 로컬 백엔드와 통신 (백엔드가 떠 있어야 함)
- `false` → 백엔드 없이 데모 데이터로만 구동 (UI 작업용)

---

## 3. 무엇이 진짜고 무엇이 목업인가 ★

**가장 중요한 섹션입니다.** 화면은 다 그려져 있지만, **전부 실제로 도는 건 아닙니다.**
"이거 왜 DB랑 다르지?" 싶으면 십중팔구 아래 표 때문입니다.

### 실제 API 연동 완료

| 기능 | 경로 |
|---|---|
| 소셜 로그인 (구글·카카오·네이버) | `/` (로그인 모달) |
| 숙소 검색·상세 | `/search`, `/homes/[id]` |
| 찜 | `/me/wishlist` |
| 메시지 (게스트↔호스트) | `/me/messages` |
| 커뮤니티 게시판 | `/community` |
| 알림 | `/me/notifications` |
| 숙소 등록 (사진 업로드·주소 지오코딩) | `/host/listings/new` |
| 숙소 관리 (승인 상태) | `/host/listings` |
| 호스트 문의함 | `/host/inquiries` |
| 호스트 리뷰 + 답글 | `/host/reviews` |
| 관리자 승인/거부 | `/admin/approvals` |

### 아직 데모 데이터 (= 손댈 거리)

| 화면 | 경로 | 백엔드 상태 |
|---|---|---|
| 관리자 대시보드 | `/admin` | `/admin/stats` 있음 → **연결만 하면 됨** |
| 회원 관리 | `/admin/members` | `/admin/members` 있음 → **연결만 하면 됨** |
| 신고 관리 | `/admin/reports` | `/admin/reports` 있음 → **연결만 하면 됨** |
| 통계·매출 | `/admin/stats`, `/admin/revenue` | 일부 있음 |
| 쿠폰·배너·공지 | `/admin/coupons`, `/banners`, `/notices` | **백엔드 없음** |
| 호스트 대시보드 | `/host` | 집계 API 필요 |
| 호스트 캘린더 | `/host/calendar` | 예약 API로 조립 가능 |
| 결제 내역 | `/me/payments` | 예약 API에 데이터 있음 |
| 내 리뷰 | `/me/reviews` | `GET /reviews`는 `roomId` 필수 → **작성자 기준 조회 추가 필요** |
| 설정 | `/me/settings` | 프로필 수정 API 필요 |

**"연결만 하면 됨"** 항목이 신규 합류자에게 가장 좋은 첫 작업입니다.
백엔드가 이미 있으니 `src/lib/api/`에 클라이언트 하나 쓰고 페이지를 바꾸면 끝입니다.
`src/lib/api/admin.ts`나 `reviews.ts`를 그대로 본떠 쓰세요.

---

## 4. 알아둘 것들 (삽질 방지)

**Prisma 마이그레이션이 없습니다.** 지금까지 `prisma db push`로만 운영했습니다.
스키마를 바꾸면 각자 `npx prisma db push`를 다시 돌려야 합니다.
→ 여러 명이 스키마를 건드리기 시작하면 `prisma migrate`로 전환해야 합니다. **미해결 과제.**

**권한(Role)은 JWT에 박혀 있습니다.** DB에서 role을 바꿔도 **다시 로그인해야** 반영됩니다.
```sql
UPDATE "User" SET role = 'HOST' WHERE email = '...';   -- HOST | ADMIN | GUEST
```

**새 숙소는 기본 미승인입니다.** (`published: false`)
검색은 `published: true`만 조회하므로, 등록해도 `/admin/approvals`에서 승인 전엔 안 보입니다. 버그 아닙니다.

**사진 업로드는 Cloudinary입니다.** 키가 없으면 파일 선택이 실패하고 "URL 붙여넣기"로 안내됩니다.
S3 코드(`storage.service.ts`)도 남아 있지만 현재 미사용입니다.

**주소는 서버에서 지오코딩합니다.** 클라이언트가 좌표를 보내지 않습니다 (주소와 다른 곳에 매물을 찍는 걸 막기 위해). 정확한 주소는 공개 API 응답에서 제거됩니다.

---

## 5. 배포

- `master`에 푸시 → **Vercel(프론트) + Railway(백엔드) 자동 배포**
- 즉 **지금은 푸시가 곧 프로덕션 반영입니다.** 브랜치 전략 논의 필요. **미해결 과제.**

Railway 관련 함정:
- 환경변수를 바꿔도 자동 재배포가 안 될 때가 있습니다 → 아무 변수나 재저장해 강제 트리거
- Console은 **배포 후 새로 열어야** 최신 컨테이너에 붙습니다
- Railway 빌드가 로컬보다 **엄격합니다** (`noUncheckedIndexedAccess`).
  백엔드를 고쳤으면 푸시 전에 반드시:
  ```bash
  cd nested-mono/apps/api && npm run build
  ```

---

## 6. 기여 흐름 (제안)

정해진 게 없습니다. 첫 회의에서 합의할 것:

1. **브랜치 전략** — `master` 직접 푸시를 막을지, PR 리뷰를 둘지
2. **작업 분배** — 모듈 단위로 나누면 충돌이 적습니다 (admin / host / 결제 / 실시간)
3. **환경 분리** — 지금 DB는 하나뿐입니다. 개발용 DB를 나눌지

---

## 7. 첫 작업 추천

합류 직후 손대기 좋은 순서:

1. **로컬 실행 성공** ← 여기서 막히면 바로 물어보세요
2. **`/admin/members` 연결** — `GET /admin/members`가 이미 있습니다. 클라이언트 하나 쓰고
   페이지를 바꾸면 끝. `src/lib/api/admin.ts`를 그대로 본뜨세요. (난이도 낮음)
3. **`/admin/reports` 연결** — 같은 패턴 + 상태 변경 (난이도 중)
4. **`/me/reviews`** — 백엔드에 "작성자 기준 리뷰 조회"를 새로 만들어야 합니다.
   `GET /reviews/mine`(호스트용)이 이미 있으니 그걸 참고하세요. 풀스택 왕복 경험. (난이도 중)
5. **`/host` 대시보드** — 집계 API 신규 설계 (난이도 상)

2번을 해보면 이 코드베이스의 프론트↔백 왕복이 한 번에 이해됩니다.
