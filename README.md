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

### 실서버 연결
```bash
# 백엔드
cd nested-mono/apps/api
npm install
docker compose up -d          # Postgres + Redis
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run seed
npm run start:dev             # :4000

# 프론트 (다른 터미널)
cd coliving
cp .env.local.example .env.local   # NEXT_PUBLIC_USE_REAL_API=true 로 변경
npm run dev                        # :3000
```

자세한 연결 구조는 [INTEGRATION.md](./INTEGRATION.md)를 참고하세요.

## 기술 스택

**프론트엔드** — Next.js 15, React 19, TypeScript, TailwindCSS, TanStack Query, Zustand, React Hook Form, Zod, Framer Motion, Socket.io Client

**백엔드** — NestJS 10, Prisma, PostgreSQL, Redis, Socket.io, BullMQ, GraphQL(옵션), JWT + OAuth 4종(Google·Kakao·Naver·Apple)

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
| 백엔드 (`nested-mono/`) | Railway | `master` 푸시 시 자동 |

**환경변수를 바꿨을 때는 재배포가 자동으로 돌지 않을 수 있습니다.** 값을 저장한 뒤
Railway 대시보드에서 재배포를 트리거하고, 컨테이너에 실제로 주입됐는지 Console에서
확인하세요 (기존 Console 세션은 이전 컨테이너를 물고 있으므로 새로 열어야 합니다):

```bash
env | grep -i google     # 값이 비어 있으면 재배포가 반영되지 않은 것
```

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
간단한 쿼리 읽기는 `window.location.search`로 대체하세요.

## 검증

| 항목 | 결과 |
|------|------|
| 프론트 빌드 | 79/79 페이지 |
| 백엔드 테스트 | 24개 통과 |
| 타입체크 | 양쪽 tsc exit 0 |

PR을 열기 전 로컬에서 확인하세요:

```bash
cd nested-mono/apps/api && npx tsc --noEmit && npm test
cd coliving && npx tsc --noEmit && npm run build
```
