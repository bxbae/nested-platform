# Nested — 팀 온보딩

코리빙/쉐어하우스 플랫폼. 이 문서는 **클론해서 로컬에서 띄우는 것**까지가 목표입니다.

- 프론트: https://my-zeta-lake.vercel.app *(⚠️ 확인 필요 — README에는 배포처가 Render로 바뀌어 있음, 아래 프론트 URL이 최신인지 팀에 확인해주세요)*
- API: https://nested-platform-production.up.railway.app *(⚠️ 확인 필요 — 5번 배포 절에는 현재 백엔드가 Railway가 아니라 Render라고 나와 있음, 실제 API 도메인으로 갱신 필요)*

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
- Docker (로컬 DB용) — **없어도 됩니다.** 회사·교육용 노트북은 BIOS 가상화가
  IT 정책으로 막혀서 Docker Desktop이 `Virtualization support not detected`로
  안 켜지는 경우가 흔합니다. 그럴 땐 아래 "Docker 없이 로컬 세팅"으로 가세요.

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

npx prisma generate
npx prisma migrate dev   # 마이그레이션 이력 기반으로 스키마 반영
npm run seed              # 샘플 데이터 (숙소·유저 등)
npm run start:dev         # → http://localhost:4000
```

### Docker 없이 로컬 세팅

**1) PostgreSQL** — [postgresql.org](https://www.postgresql.org/download/windows/)에서
직접 설치 후:
```sql
CREATE USER nested WITH PASSWORD 'nested';
ALTER USER nested CREATEDB;
CREATE DATABASE nested OWNER nested;
```
`.env`의 `DATABASE_URL`을 `postgresql://nested:nested@localhost:5432/nested?schema=public`로.

**2) Redis** — WSL(Ubuntu)에 설치:
```powershell
wsl --install -d Ubuntu   # 재부팅 필요할 수 있음
```
```bash
# WSL 안에서
sudo apt update && sudo apt install redis-server -y
sudo service redis-server start
redis-cli ping   # PONG 나오면 정상
```
⚠️ 컴퓨터를 켤 때마다 자동으로 안 켜져 있으니, 백엔드 실행 전에 매번
`wsl -d Ubuntu` → `sudo service redis-server start`를 해줘야 합니다.

이후 `docker compose up -d` 줄만 빼고 위 백엔드 순서를 그대로 따르면 됩니다.

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

> ⚠️ 이 섹션에 예전엔 기능별 표가 직접 있었는데, 실제 코드 상태랑 계속 벌어지는
> 문제가 반복됐습니다(예: 관리자 대시보드·회원 관리·신고 관리·쿠폰 관리가 표에는
> "데모/미구현"이라고 남아있었지만 실제로는 오래전에 완료된 상태). 같은 정보를
> 문서 두 개에서 따로 관리하면 이렇게 벌어지기 쉬워서, **최신 상태는 이제
> [`FEATURES.md`](./FEATURES.md) 하나로만 관리합니다.** 상태 열(✅완료 / 🟡연결·확인
> 필요 / 🔴미구현)을 거기서 확인하세요.

**"🟡 연결 필요"로 표시된 항목이 신규 합류자에게 가장 좋은 첫 작업입니다.**
백엔드가 이미 있으니 `src/lib/api/`에 클라이언트 하나 쓰고 페이지를 바꾸면 끝입니다.
`src/lib/api/admin.ts`나 `reviews.ts`를 그대로 본떠 쓰세요.

---

## 4. 알아둘 것들 (삽질 방지)

**Prisma 마이그레이션을 씁니다.** 스키마를 바꿀 땐 `schema.prisma` 수정 →
`npx prisma migrate dev` → 생성된 마이그레이션 파일까지 커밋, 이 순서를 지켜주세요.
`migrate dev`를 건너뛰고 스키마 파일만 고치면 로컬 DB엔 반영 안 된 채 코드는 새
필드를 참조하게 돼서 `P2022`(컬럼 없음) 에러가 납니다.

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

- `master`에 푸시 → **Vercel(프론트) + Render(백엔드) 자동 배포**
- 브랜치 전략은 이미 정해져 있습니다 — `master`에 직접 푸시하지 않고, 기능 단위
  브랜치(`feat/`·`fix/`·`refactor/`·`docs/`)를 파서 PR로 Squash merge합니다.
  자세한 규칙은 [README.md](./README.md#팀-개발-가이드)를 참고하세요.

Render 관련 함정:
- 환경변수를 바꿔도 자동 재배포가 안 될 때가 있습니다 → 대시보드에서 수동으로
  Manual Deploy 트리거
- Shell/로그는 **재배포 후 새로 열어야** 최신 컨테이너에 붙습니다
- Render 빌드가 로컬보다 **엄격합니다** (`noUncheckedIndexedAccess`).
  백엔드를 고쳤으면 푸시 전에 반드시:
  ```bash
  cd nested-mono/apps/api && npm run build
  ```

---

## 6. 기여 흐름

- **브랜치 전략** — 확정됨. 위 5번 참고.
- **작업 분배** — `FEATURES.md`의 역할 분담 표를 참고하세요. 모듈 단위로
  나뉘어 있어 충돌이 적습니다.
- **환경 분리** — 지금 DB는 하나뿐입니다. 필요해지면 논의.

---

## 7. 첫 작업 추천

합류 직후 손대기 좋은 순서:

1. **로컬 실행 성공** ← 여기서 막히면 바로 물어보세요
2. **[`FEATURES.md`](./FEATURES.md)에서 🟡(연결·확인 필요) 항목 하나 골라서 연결** —
   백엔드는 이미 있고 프론트만 실 데이터로 바꾸면 되는 것들이라 난이도가 낮습니다.
   `src/lib/api/admin.ts`나 `reviews.ts`를 그대로 본뜨면 됩니다.
3. **🔴(미구현) 항목 중 하나로 풀스택 왕복** — 백엔드부터 만들어야 해서 난이도는
   올라가지만, 이 코드베이스의 프론트↔백 구조를 제대로 이해하게 됩니다.

> 예전엔 여기 구체적인 작업 이름(예: "`/admin/members` 연결", "`/me/reviews`")을
> 하드코딩해뒀었는데, 다 완료된 뒤에도 이 목록이 안 지워져서 신규 합류자가 이미
> 끝난 작업을 다시 집으려는 문제가 있었습니다. 지금 진짜로 남아있는 작업은 항상
> `FEATURES.md`의 상태 열이 정답입니다.
