# Nested — 공유주거 플랫폼

에어비앤비 × 애플 스타일의 공유주거(셰어하우스) 플랫폼. 20~40대 직장인·장기 거주자 대상.
브랜드 컬러: 코럴 `#FF5A5F` + 틸 `#00A699`.

프론트엔드(Next.js 15)와 백엔드(NestJS)가 하나의 저장소에 함께 있는 모노레포입니다.

## 구조

```
nested-platform/
├── coliving/          # 프론트엔드 (Next.js 15 · React 19 · TanStack · Zustand)
├── nested-mono/       # 백엔드 모노레포
│   ├── apps/api/      #   NestJS API (Prisma · PostgreSQL · Redis · Socket.io)
│   ├── packages/ui/   #   shadcn UI 라이브러리 (Atomic Design)
│   └── showcase/      #   UI 컴포넌트 갤러리
└── INTEGRATION.md     # 프론트 ↔ 백엔드 연결 가이드
```

## 빠른 시작

### 오프라인 데모 (백엔드 불필요)
```bash
cd coliving
npm install
npm run dev            # http://localhost:3000
```

### 로컬 풀스택 (백엔드까지 직접 실행)

Postgres와 Redis가 필요합니다. Docker를 쓰지 않는다면 Homebrew로 설치하세요.

```bash
# 1) DB · 캐시 (macOS · 최초 1회)
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis

export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
createuser -s nested && createdb -O nested nested
psql -c "ALTER USER nested PASSWORD 'nested';"

# 2) 백엔드
cd nested-mono/apps/api
npm install
cp .env.example .env          # DATABASE_URL 등을 로컬 값으로
npx prisma generate
npx prisma migrate deploy     # 테이블 생성
npm run seed                  # 샘플 데이터 + 테스트 계정
npm run start:dev             # :4000

# 3) 프론트 (다른 터미널)
cd coliving
cp .env.local.example .env.local   # NEXT_PUBLIC_USE_REAL_API=true 로 변경
npm run dev                        # :3000
```

시드가 만드는 테스트 계정 (로컬 DB 전용):

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 호스트 | `host@nested.kr` | `password123` |
| 게스트 | `guest@nested.kr` | `password123` |

### 프론트만 실행 (배포된 API에 연결 — 가장 빠름)

DB·Redis 설치 없이 실제 데이터로 화면을 볼 수 있습니다. 프론트만 작업할 때 권장.

```bash
cd coliving
npm install
cat > .env.local <<'EOF'
NEXT_PUBLIC_USE_REAL_API=true
NEXT_PUBLIC_API_URL=https://nested-api.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://nested-api.onrender.com
EOF
npm run dev            # :3000
```

> 무료 인스턴스라 15분 유휴 후 잠듭니다. 첫 요청은 30~60초 걸릴 수 있습니다.

자세한 연결 구조는 [INTEGRATION.md](./INTEGRATION.md)를 참고하세요.

## 기술 스택

**프론트엔드** — Next.js 15, React 19, TypeScript, TailwindCSS, TanStack Query, Zustand, React Hook Form, Zod, Framer Motion, Socket.io Client

**백엔드** — NestJS 10, Prisma, PostgreSQL, Redis, Socket.io, BullMQ, GraphQL(옵션), JWT + OAuth 4종(Google·Kakao·Naver·Apple)

## 주요 기능

**게스트**
- 숙소 검색 — 지역·가격·방 타입 필터, **숙박 기간 선택 시 이미 예약된 방 자동 제외**
- 예약 — 실시간 견적(서버 계산) → 홀드(PENDING_PAYMENT) → 결제 확정, **쿠폰 코드 적용**
- 생활 성향 설문 9문항 → **룸메이트 매칭** (궁합 점수 + 매칭 근거)
- 커뮤니티 — 글 작성·**수정**·삭제, 댓글
- 이메일 인증 (메일 제공자 설정 시 미인증 로그인 차단)

**호스트** — 숙소 등록·관리, 예약 관리, 캘린더, 정산, 리뷰 답글

**관리자** (`/admin`)
- 회원 관리 · 숙소 승인 · 신고 처리 (신고된 글은 관리자가 삭제 가능)
- 전체 예약 조회 (상태 필터 · 페이지네이션)
- 매출 통계 — 월별 거래액 · 예약 건수 추이 (실제 집계)
- 공지 · 배너 관리 (홈 화면에 공개 노출)
- 쿠폰 발급 · 사용 통계

### 매칭 알고리즘

9개 성향 축(소음·청결·흡연·반려동물·방문객·수면·사교성·공용공간·음주)을 각각
`0·1·2` 인덱스로 보고 비교합니다.

- **하드 필터** — 흡연 / 반려동물 / 방문객이 정반대(차이 2)면 후보에서 제외
- **거리 점수** — 9축 전부에 대해 차이 0 → 1.0, 1 → 0.5, 2 → 0. 동일 가중치 평균 × 100
- **프라이버시** — 상대의 성향 원본은 반환하지 않고 궁합 점수·근거·최소 프로필만 노출

## 팀 개발 가이드

### 브랜치 전략

`master`에 직접 푸시하지 않습니다. 기능 단위로 브랜치를 파고 PR로 병합합니다.

```bash
git checkout master && git pull          # 항상 최신에서 시작
git checkout -b feat/reservation-cancel  # 브랜치 생성
# ... 작업 ...
git push -u origin feat/reservation-cancel
```

GitHub에서 PR을 열면 Vercel이 **프리뷰 URL**을 자동 생성합니다. 리뷰어는 그 링크로
실제 화면을 확인한 뒤 승인합니다. 병합은 Squash merge로 커밋 히스토리를 깔끔히 유지합니다.

브랜치 이름 규칙:

| 접두사 | 용도 | 예시 |
|--------|------|------|
| `feat/` | 새 기능 | `feat/host-dashboard` |
| `fix/` | 버그 수정 | `fix/reservation-fk-500` |
| `refactor/` | 동작 변화 없는 개선 | `refactor/api-client` |
| `docs/` | 문서만 | `docs/readme-team-setup` |

### 작업 분담

프론트(`coliving/`)와 백엔드(`nested-mono/`)의 경계가 뚜렷해서 충돌이 적습니다.
한 기능을 풀스택으로 맡을 때는 **백엔드 → 프론트 순서**로 진행하고, API 스키마가
확정되면 팀에 공유해 프론트 작업이 병렬로 진행되게 합니다.

### 환경변수

`.env`는 **절대 커밋하지 않습니다** (`.gitignore`로 차단됨). 대신 템플릿을 씁니다.

```bash
cd nested-mono/apps/api && cp .env.example .env        # 백엔드
cd coliving && cp .env.local.example .env.local        # 프론트
```

실제 값(DB 비밀번호, OAuth 키 등)은 git·공개 채널에 올리지 말고 비밀번호 관리
도구나 팀 비공개 채널로 공유하세요. 새 환경변수를 추가하면 **`.env.example`에도
반드시 이름을 추가**해서 다른 팀원이 무엇이 필요한지 알 수 있게 합니다.

### 소셜 로그인 셋업

OAuth는 코드만으로 동작하지 않습니다. 각 제공자 콘솔에 **콜백 URL 등록**이 필요합니다.

| 제공자 | 콘솔 | 등록할 콜백 URL |
|--------|------|----------------|
| Google | Cloud Console → 사용자 인증 정보 | `{API_URL}/auth/google/callback` |
| Kakao | Kakao Developers → 카카오 로그인 | `{API_URL}/auth/kakao/callback` |
| Naver | Naver Developers → API 설정 | `{API_URL}/auth/naver/callback` |

`{API_URL}`은 로컬이면 `http://localhost:4000`, 운영이면 배포된 API 도메인입니다.
콜백은 **프론트가 아니라 API 서버**를 가리킵니다.

제공자별 주의사항:

- **Kakao** — `KAKAO_CLIENT_ID`는 REST API 키입니다. 콘솔에서 *클라이언트 시크릿*을
  "사용함"으로 켰다면 `KAKAO_CLIENT_SECRET`도 채워야 합니다 (안 그러면 KOE010).
- **Naver** — 콜백 URL 외에 **서비스 URL**에도 프론트 도메인을 등록해야 합니다.
  앱이 "개발 중" 상태면 **멤버관리 탭에 등록된 네이버 아이디만** 로그인됩니다.
- **공통** — 콘솔에서 값을 복사할 때 끝 글자가 잘리기 쉽습니다
  (`...googleusercontent.co` ← `m` 누락). 반드시 복사 버튼을 쓰세요.

### 배포

| 대상 | 플랫폼 | 트리거 |
|------|--------|--------|
| 프론트 (`coliving/`) | Vercel | `master` 푸시 시 자동 |
| 백엔드 (`nested-mono/apps/api`) | Render | `master` 푸시 시 자동 |
| PostgreSQL | Neon | — |
| Redis | Upstash | — |

모두 영구 무료 티어입니다. 백엔드는 `https://nested-api.onrender.com`.

Render 서비스 설정 (모노레포라 루트 지정이 필수):

| 항목 | 값 |
|------|-----|
| Root Directory | `nested-mono/apps/api` |
| Build Command | `npm install --include=dev && npx prisma generate && npm run build` |
| Start Command | `npx prisma migrate deploy && node dist/main` |

Start Command에 `prisma migrate deploy`가 들어 있어 **배포할 때마다 마이그레이션이
자동 적용**됩니다. 스키마를 바꾼 기능은 머지만 하면 운영 DB에 반영됩니다.

**환경변수를 바꾸면 Vercel은 자동 재배포되지 않습니다.** 값을 저장한 뒤
Deployments에서 Redeploy를 눌러야 새 값이 적용됩니다. Render는 저장 시 자동 재배포됩니다.

## 트러블슈팅

이 프로젝트에서 실제로 겪은 문제들입니다. 같은 증상이면 여기부터 확인하세요.

**예약 생성 시 500 (`Reservation_guestId_fkey` FK 위반)**
컨트롤러에 `@UseGuards(JwtAuthGuard)`가 빠지면 `req.user`가 비어 guestId가
placeholder로 채워집니다. 인증이 필요한 라우트에 가드가 걸렸는지 확인하세요.

**결제 422 `TOSS_SECRET_KEY 미설정`**
PSP 키 없이 개발할 때는 `paymentKey`를 `demo_`로 시작하게 보내면 게이트웨이가
실제 PSP 호출을 건너뜁니다. 실키를 넣으면 자동으로 실검증으로 전환됩니다.

**예약 409 `선택한 기간은 이미 예약되었습니다`**
결제까지 못 간 `PENDING_PAYMENT` 홀드가 남아 날짜를 막고 있는 경우입니다.
다른 날짜로 테스트하거나 해당 예약을 취소하세요.

**소셜 로그인 `invalid_client` / `KOE006` / `client info invalid`**
대부분 (1) 콘솔에 콜백 URL 미등록, (2) 환경변수 값 잘림, (3) 변수 변경 후
재배포 미반영 셋 중 하나입니다. 위 "소셜 로그인 셋업" 절을 참고하세요.

**`useSearchParams` 빌드 실패 (`missing-suspense-with-csr-bailout`)**
전역 컴포넌트에서 `useSearchParams()`를 쓰면 정적 페이지 프리렌더가 깨집니다.
페이지 단위라면 `<Suspense>`로 감싸고, 간단한 쿼리 읽기는 `window.location.search`로
대체하세요.

**환경변수 값에 키 이름이 섞여 들어감**
대시보드에 `KEY=value` 한 줄을 통째로 붙여넣으면 값이 `KEY=value`가 됩니다.
카카오·네이버 로그인이 이 이유로 막혔습니다. Value에는 **값만** 넣으세요.

```
❌ NAVER_CALLBACK_URL = NAVER_CALLBACK_URL=https://…/auth/naver/callback
✅ NAVER_CALLBACK_URL = https://…/auth/naver/callback
```

**소셜 로그인 후 `localhost` 로 튕김 (`ERR_CONNECTION_REFUSED`)**
백엔드가 인증 완료 후 `FRONTEND_URL`로 리다이렉트합니다. 이 값이 없으면 기본값인
`http://localhost:3000`으로 보내므로, 운영 환경에는 반드시 설정하세요.

**Render 배포 실패 `sh: 1: nest: not found`**
`@nestjs/cli`가 devDependency라 프로덕션 설치에서 빠집니다.
Build Command에 `npm install --include=dev`를 쓰세요.

**Render 배포 중 `JavaScript heap out of memory`**
무료 인스턴스(512MB)에서 `nest start`는 무겁습니다. 빌드 산출물을 직접 실행하세요:
`node dist/main`.

**Redis 연결 `Invalid URL`**
Upstash는 REST URL(`https://…`)과 Redis 프로토콜 URL을 모두 제공합니다.
ioredis/BullMQ는 후자만 쓰며, TLS이므로 **`rediss://`**(s 두 개)여야 합니다.

**로컬에서 `_next` 청크 404 · `_document.js` ENOENT**
dev 서버가 여러 개 떠서 빌드가 꼬인 경우입니다.

```bash
lsof -ti :3000 | xargs kill -9
rm -rf .next && npm run dev
```

**로컬 마이그레이션은 운영 DB에 반영되지 않음**
`prisma migrate dev`는 로컬 전용입니다. 운영 반영은 `migrate deploy`이며, 현재는
Render Start Command에 포함되어 배포 시 자동 실행됩니다. 수동으로 하려면:

```bash
DATABASE_URL="<운영 DB URL>" npx prisma migrate deploy
```

## 검증

| 항목 | 결과 |
|------|------|
| 프론트 빌드 | 49/49 페이지 |
| 백엔드 테스트 | 46개 통과 (7 스위트) |
| 타입체크 | 양쪽 tsc exit 0 |

PR을 열기 전 로컬에서 확인하세요:

```bash
cd nested-mono/apps/api && npx tsc --noEmit && npm test
cd coliving && npx tsc --noEmit && npm run build
```
