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

## 검증

| 항목 | 결과 |
|------|------|
| 프론트 빌드 | 79/79 페이지 |
| 백엔드 테스트 | 24개 통과 |
| 타입체크 | 양쪽 tsc exit 0 |
