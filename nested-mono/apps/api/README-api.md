# @nested/api — NestJS backend

Full backend stack, wired as real NestJS modules.

## Stack
- **NestJS 10** + **TypeScript** (strict) — modular architecture
- **Prisma ORM** — `prisma/schema.prisma` (User, Room, Reservation, Payment, Review, Message, Coupon, RefreshToken, Image) + `PrismaService` + Serializable reservation repo
- **REST API** — `auth`, `reservations`, `payments` controllers
- **GraphQL** (optional) — code-first `RoomsResolver`, Apollo driver, auto-schema
- **JWT** — `@nestjs/jwt` access(15m)/refresh(7d) tokens, `JwtStrategy`, `JwtAuthGuard`
- **OAuth** — Google (`passport-google-oauth20`), find-or-create + token issue
- **Redis** — `ioredis` (`RedisService`) for cache + Socket.io pub/sub adapter + BullMQ connection
- **Socket.io** — `ChatGateway` (`/chat` namespace) with `message:send/new/read` + `typing`, Redis-adapter scaled
- **BullMQ** — `notifications` queue + `NotificationsProcessor` worker (push/email/settlement), repeatable jobs

## Modules
```
src/
  main.ts                    # bootstrap + Redis Socket.io adapter
  app.module.ts              # Config, GraphQL, BullMQ root, all feature modules
  prisma/                    # PrismaModule + PrismaService
  redis/                     # RedisModule + RedisService (ioredis)
  modules/
    auth/                    # JWT + Google OAuth, guards (Jwt/Google/Roles)
    reservations/            # quote → create → confirmPayment (17 tests)
    chat/                    # Socket.io gateway
    notifications/           # BullMQ producer + worker
    rooms/                   # GraphQL resolver
```

## Run
```
npm install
npx prisma generate          # requires network for the query engine
npm test                     # 17 reservation/pricing tests pass
npm run start:dev            # needs Postgres + Redis running
```

## Notes
- `bcryptjs` (pure-JS) is used so no native build is required.
- Prisma client generation needs network access to download the query engine;
  the code typechecks against the shipped base types.

## Storage (AWS S3 + CloudFront)
`modules/storage/` — direct-to-S3 uploads + CDN delivery.

- **Presigned upload** — `POST /storage/presign` (JWT-protected) returns a
  presigned S3 PUT URL + object key + CloudFront URL. The browser PUTs the file
  straight to S3, keeping large uploads off the API. Type/size validated
  (jpeg/png/webp/avif, ≤10MB).
- **CloudFront delivery** — reads are served from `CLOUDFRONT_DOMAIN`
  (private bucket + Origin Access Control), never from S3 directly.
- **Signed CDN URLs** — `signedCdnUrl(key, ttl)` for private/expiring assets
  via `@aws-sdk/cloudfront-signer`; falls back to public URL when no key pair set.
- **Delete** — `DELETE /storage/:key` removes an object (e.g. when a listing
  image is deleted).

Env: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`,
`CLOUDFRONT_DOMAIN`, and optionally `CLOUDFRONT_KEY_PAIR_ID` / `CLOUDFRONT_PRIVATE_KEY`.

## Authentication
`modules/auth/` — six sign-in paths, all issuing the same JWT pair.

- **Email** — `POST /auth/register`, `POST /auth/login` (bcryptjs password hash)
- **Google** — `GET /auth/google` → `/auth/google/callback` (passport-google-oauth20)
- **Kakao** — `GET /auth/kakao` → `/auth/kakao/callback` (passport-kakao)
- **Naver** — `GET /auth/naver` → `/auth/naver/callback` (passport-naver-v2)
- **Apple** — `GET /auth/apple` → `POST /auth/apple/callback` (passport-apple)
- **JWT Refresh Token** — access(15m)/refresh(7d). Refresh tokens are hashed
  (SHA-256) and stored in the `RefreshToken` table; `POST /auth/refresh`
  **rotates** them (old deleted, new issued) and rejects unknown/revoked tokens.
  `logoutAll(userId)` revokes every session.

All OAuth providers funnel through one provider-agnostic `validateOAuthUser()`
(find-or-create + link by email), so adding a provider is just a new strategy.

## Data Model (20 models)
`prisma/schema.prisma` covers the full domain:

- **User** + **HostProfile** (Host: superhost, payout info) + **RefreshToken**
- **Property** (building/address) → **Room** (rentable unit) → **Image**
- **Amenity** + **RoomAmenity** (M:N room amenities)
- **Reservation** → **Payment** → **Settlement** (monthly host payout)
- **CalendarBlock** (per-room availability/blocked dates)
- **ChatRoom** → **Message** (guest↔host conversations)
- **Wishlist** + **Favorite** (saved rooms)
- **Review**, **Coupon**, **Notification**, **Report** (moderation)

Enums: Role, RoomType, GenderPolicy, ReservationStatus, PaymentStatus,
NotificationType, ReportTargetType, ReportStatus, SettlementStatus.

## REST API Endpoints
| Domain | Endpoints |
|--------|-----------|
| 회원가입/로그인 | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me` |
| OAuth | `GET /auth/{google,kakao,naver}`, `GET|POST /auth/{...}/callback` |
| 숙소 CRUD | `GET /rooms`, `GET /rooms/:id`, `POST /rooms`, `PATCH /rooms/:id`, `DELETE /rooms/:id` |
| 검색 | `GET /rooms?region=&q=&roomType=&minRent=&maxRent=&cursor=` (커서 페이지네이션) |
| 예약 CRUD | `POST /reservations/quote`, `POST /reservations`, `GET /reservations/:id`, `PATCH /reservations/:id/cancel` |
| 결제 | `POST /payments/confirm` |
| 메시지 | `GET /messages/rooms`, `POST /messages/rooms`, `GET /messages/:chatRoomId`, `POST /messages/:chatRoomId` (+ Socket.io `/chat`) |
| 리뷰 | `GET /reviews?roomId=`, `POST /reviews`, `PATCH /reviews/:id/reply` |
| 찜 | `GET /favorites`, `POST /favorites`, `DELETE /favorites/:roomId` |
| 알림 | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |
| 파일 업로드 | `POST /storage/presign`, `DELETE /storage/:key` |
| 관리자 | `GET /admin/stats`, `GET|PATCH /admin/members`, `GET|PATCH /admin/rooms/pending|:id/publish`, `GET|PATCH /admin/reports` |

Auth: JWT bearer on protected routes; `@Roles("HOST"|"ADMIN")` where noted.
