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
├── docs/
│   └── reservation-platform-erd.md  # ERD 문서 (schema.prisma 기준)
├── INTEGRATION.md     # 프론트 ↔ 백엔드 연결 가이드
├── FEATURES.md        # 기능 정의서 / 작업 배분 (상태: ✅완료 🟡연결필요 🔴미구현)
├── ISSUES.md          # FEATURES.md 항목별 상세 이슈
└── ONBOARDING.md       # 로컬 실행, 프로젝트 구조, 진짜/목업 구분
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
docker compose up -d          # Postgres + Redis (Docker Desktop 필요)
cp .env.example .env
npx prisma generate
npx prisma migrate dev        # 마이그레이션 이력 기반으로 스키마 반영
npm run seed
npm run start:dev             # :4000

# 프론트 (다른 터미널)
cd coliving
cp .env.local.example .env.local   # NEXT_PUBLIC_USE_REAL_API=true 로 변경
npm run dev                        # :3000
```

> **회사·교육용 노트북에서 Docker Desktop이 "Virtualization support not detected"로 안 켜지는 경우가 흔합니다** (BIOS 가상화 옵션이 IT 정책으로 잠긴 경우 등). 이럴 땐 Docker 없이 Postgres/Redis를 각각 직접 설치하면 됩니다 — 아래 "Docker 없이 로컬 세팅" 참고.

자세한 연결 구조는 [INTEGRATION.md](./INTEGRATION.md)를, DB 구조는 [docs/reservation-platform-erd.md](./docs/reservation-platform-erd.md)를 참고하세요.

> 스키마를 바꿀 때는 **`schema.prisma` 수정 → `npx prisma migrate dev` → 생성된 마이그레이션 파일을 커밋**까지 한 세트로 진행하세요. `migrate dev`를 건너뛰고 `schema.prisma`만 고치면, 로컬 DB엔 반영이 안 됐는데 코드는 새 필드를 참조하는 상태가 되어 `P2022`(컬럼 없음) 에러가 납니다 — 자주 겪는 문제라 아래 트러블슈팅에도 따로 적어뒀습니다.

### Docker 없이 로컬 세팅

Docker Desktop이 가상화 오류로 안 켜지면, 이렇게 네이티브로 설치하면 됩니다.

**1) PostgreSQL** — [postgresql.org](https://www.postgresql.org/download/windows/)에서 설치 후:
```sql
CREATE USER nested WITH PASSWORD 'nested';
ALTER USER nested CREATEDB;
CREATE DATABASE nested OWNER nested;
```
`.env`의 `DATABASE_URL`을 `postgresql://nested:nested@localhost:5432/nested?schema=public`로 맞춥니다.

**2) Redis** — WSL(Ubuntu) 안에 설치합니다.
```powershell
wsl --install -d Ubuntu   # WSL 자체가 없으면 먼저 설치, 재부팅 필요할 수 있음
```
```bash
# WSL(Ubuntu) 안에서
sudo apt update && sudo apt install redis-server -y
sudo service redis-server start
redis-cli ping   # PONG 나오면 정상
```
⚠️ WSL의 Redis는 컴퓨터를 켤 때마다 자동으로 안 켜져 있습니다. 백엔드 실행 전에 매번 `wsl -d Ubuntu` → `sudo service redis-server start`를 해줘야 합니다. Redis가 안 켜진 채로 백엔드를 켜면 `[ioredis] ECONNREFUSED` 로그가 계속 찍히다가 결국 `MaxRetriesPerRequestError`로 죽습니다.

이후 `docker compose up -d` 줄만 빼고 위 "실서버 연결" 순서를 그대로 따르면 됩니다.

## 기술 스택

**프론트엔드** — Next.js 15, React 19, TypeScript, TailwindCSS, TanStack Query, Zustand, React Hook Form, Zod, Framer Motion, Socket.io Client

**백엔드** — NestJS 10, Prisma, PostgreSQL, Redis, Socket.io, BullMQ, GraphQL(옵션), JWT + OAuth 3종(Google·Kakao·Naver)

> Apple 로그인은 이전 문서에 언급되어 있었지만, 현재 셋업 가이드·FEATURES.md 어디에도 구현/설정 내용이 없어 3종으로 정정했습니다. 실제로 Apple OAuth를 붙이셨다면 이 표기와 아래 "소셜 로그인 셋업" 표를 함께 업데이트해주세요.

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

| 접두사         | 용도          | 예시                       |
| ----------- | ----------- | ------------------------ |
| `feat/`     | 새 기능        | `feat/host-dashboard`    |
| `fix/`      | 버그 수정       | `fix/reservation-fk-500` |
| `refactor/` | 동작 변화 없는 개선 | `refactor/api-client`    |
| `docs/`     | 문서만         | `docs/readme-team-setup` |

### 작업 분담

프론트(`coliving/`)와 백엔드(`nested-mono/`)의 경계가 뚜렷해서 충돌이 적습니다.
한 기능을 풀스택으로 맡을 때는 **백엔드 → 프론트 순서**로 진행하고, API 스키마가
확정되면 팀에 공유해 프론트 작업이 병렬로 진행되게 합니다.

작업을 고를 땐 [FEATURES.md](./FEATURES.md)의 상태 열(✅/🟡/🔴)을 먼저 확인하세요 — 이미 구현된 기능을 중복 작업하지 않기 위함입니다.

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

| 제공자    | 콘솔                         | 등록할 콜백 URL                       |
| ------ | -------------------------- | -------------------------------- |
| Google | Cloud Console → 사용자 인증 정보  | `{API_URL}/auth/google/callback` |
| Kakao  | Kakao Developers → 카카오 로그인 | `{API_URL}/auth/kakao/callback`  |
| Naver  | Naver Developers → API 설정  | `{API_URL}/auth/naver/callback`  |

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

| 대상                   | 플랫폼     | 트리거              |
| -------------------- | ------- | ---------------- |
| 프론트 (`coliving/`)    | Vercel  | `master` 푸시 시 자동 |
| 백엔드 (`nested-mono/`) | Render  | `master` 푸시 시 자동 |

**환경변수를 바꿨을 때는 재배포가 자동으로 돌지 않을 수 있습니다.** 값을 저장한 뒤
Render 대시보드에서 재배포를 트리거하고, 컨테이너에 실제로 주입됐는지 Shell/로그에서
확인하세요 (기존 세션은 이전 컨테이너를 물고 있으므로 새로 열어야 합니다):

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

**`The column "칼럼"/"칼럼은" does not exist in the current database` (P2022)**
Postgres가 한국어 로케일로 에러 메시지를 내보내면, Prisma가 그 문장에서 실제
컬럼명을 잘못 잘라내서 저렇게 깨진 이름으로 보여줍니다 — 컬럼명 자체는 무시하고,
"스키마 파일과 실제 DB가 안 맞다"로 읽으면 됩니다. 두 가지 경우로 나뉩니다.
- `schema.prisma`엔 필드가 있는데 `npx prisma generate`를 안 돌려서 **생성된 타입만
낡은 경우** → `npx prisma generate` 한 번이면 해결됩니다.
- **DB 자체에 컬럼이 없는 경우**(마이그레이션을 안 돌렸거나, `schema.prisma`만
고치고 `migrate dev`를 건너뛴 경우) → `npx prisma migrate dev`까지 돌려야 합니다.

`npx prisma migrate status`로 "적용 안 된 마이그레이션"이 있는지 먼저 확인하면
둘 중 어느 쪽인지 빨리 구분됩니다.

**로컬 백엔드가 안 뜨거나, `[ioredis] ECONNREFUSED`가 반복 출력됨**
Redis(WSL)가 안 켜져 있는 상태입니다. 특히 컴퓨터를 새로 켠 직후에 자주 겪습니다.
```bash
wsl -d Ubuntu
sudo service redis-server start
```
켜져 있는지 잊었다면 재시작 전에 `redis-cli ping`으로 먼저 확인하세요. Redis를
나중에 켜도 이미 죽은 백엔드 프로세스는 자동으로 재연결되지 않을 때가 있어서,
백엔드도 같이 껐다 켜는 게 확실합니다.

**Docker Desktop `Virtualization support not detected`**
회사·교육용 노트북에서 BIOS 가상화가 IT 정책으로 잠긴 경우 흔하게 겪습니다.
억지로 뚫으려 하지 말고, 위 "Docker 없이 로컬 세팅" 절로 Postgres/Redis를
네이티브로 설치하면 됩니다.

**로컬에서는 잘 되는데 배포된 사이트에서만 옛 버전처럼 동작함**
아래 순서로 "배포가 실제로 최신 커밋을 반영했는지"부터 확인하세요 — 코드
버그보다 이 경우가 훨씬 잦습니다.
```bash
git log -1 --oneline                 # 로컬이 보고 있는 최신 커밋
git log origin/master -1 --oneline   # 원격 master의 최신 커밋
```
두 해시가 같은데도 이상하면, 배포 플랫폼(Render/Vercel) Deploys 탭에서 실제
배포에 찍힌 커밋 해시를 대조하세요. 배포가 실패하면 이전 버전이 계속 떠있는
채로 아무 표시가 없기 때문에, "고쳤는데 반영이 안 된 것처럼" 보이는 원인의
대부분이 여기 있습니다.

## 검증

PR을 열기 전 로컬에서 아래를 돌려서 통과하는지 확인하세요. (구체적인 페이지 수·테스트 개수는
기능이 계속 추가되면서 계속 바뀌므로, 여기 고정된 숫자를 적어두지 않습니다 — CI 로그의
`Tests: N passed, N total`을 그때그때 확인하세요.)

```bash
cd nested-mono/apps/api && npx tsc --noEmit && npm test
cd coliving && npx tsc --noEmit && npm run build
```

> 테스트가 실패하는데 내가 건드린 부분이 아닌 것 같다면, 실패한 스펙 파일이 최근에
> 이름/enum 값이 바뀐 기능을 테스트하고 있는지 확인하세요 (예: 등급 이름을
> `REGULAR`→`SPROUT`처럼 바꾸고 테스트를 안 고친 경우). 소스와 테스트 중 어느 쪽이
> 최신 의도인지 헷갈리면 그 기능을 만든 사람에게 먼저 물어보고 고치는 게 안전합니다.

## 참고 문서

- [FEATURES.md](./FEATURES.md) — 기능 정의서, 상태(✅/🟡/🔴), 작업 배분
- [ISSUES.md](./ISSUES.md) — 기능별 상세 이슈
- [ONBOARDING.md](./ONBOARDING.md) — 로컬 실행, 진짜/목업 구분
- [INTEGRATION.md](./INTEGRATION.md) — 프론트 ↔ 백엔드 연결 가이드
- [docs/reservation-platform-erd.md](./docs/reservation-platform-erd.md) — ERD (schema.prisma 기준)
