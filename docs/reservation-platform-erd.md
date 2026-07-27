# Nested 공유주거 플랫폼 — ERD (schema.prisma 기준)

> 출처: `nested-mono/apps/api/prisma/schema.prisma` (2026-07-27 업로드본)
> 구성: Core ERD / Community ERD / Ops·Admin ERD

이전 버전은 도메인 추정으로 그린 초안이었고, 이 문서는 **실제 Prisma 스키마를 그대로 반영**합니다. cuid 문자열 PK, enum, self-relation, 1:1 옵셔널 관계 등 스키마의 실제 설계를 그대로 옮겼습니다.

---

## 1. Core ERD (숙소·예약·결제·정산)

```mermaid
erDiagram
    USER ||--o{ ROOM : hosts
    USER ||--o{ PROPERTY : owns
    USER ||--o| HOST_PROFILE : has
    PROPERTY ||--o{ ROOM : contains
    ROOM ||--o{ IMAGE : has
    ROOM ||--o{ ROOM_AMENITY : has
    AMENITY ||--o{ ROOM_AMENITY : mapped_by
    ROOM ||--o{ CALENDAR_BLOCK : has
    ROOM ||--o{ RESERVATION : booked_in
    USER ||--o{ RESERVATION : "guest of"
    USER ||--o{ RESERVATION : "companion of (nullable)"
    RESERVATION ||--o{ RESERVATION_COMPANION_MEMBER : has
    USER ||--o{ RESERVATION_COMPANION_MEMBER : joins
    RESERVATION ||--o{ CONTRACT_CHANGE_REQUEST : has
    RESERVATION ||--o| PAYMENT : has
    RESERVATION ||--o| SETTLEMENT : has
    RESERVATION ||--o| TENANT_REVIEW : has
    ROOM ||--o{ REVIEW : has
    USER ||--o{ REVIEW : writes
    USER ||--o{ SETTLEMENT : receives
    USER ||--o{ WISHLIST : has
    WISHLIST ||--o{ FAVORITE : contains
    USER ||--o{ FAVORITE : saves
    ROOM ||--o{ FAVORITE : saved_as
    USER ||--o{ REFRESH_TOKEN : has
    USER ||--o{ PASSWORD_RESET_TOKEN : has
    USER ||--o{ EMAIL_VERIFICATION_TOKEN : has
    USER ||--o{ TENANT_REVIEW : "writes (author)"
    USER ||--o{ TENANT_REVIEW : "receives (tenant)"

    USER {
        string id PK "cuid"
        string email UK
        string passwordHash "nullable, OAuth-only는 null"
        string name
        boolean nicknameCompleted
        enum role "GUEST, HOST, ADMIN"
        string provider "google 등, nullable"
        string providerId "nullable"
        string avatarColor
        string avatarUrl "nullable"
        string bio "nullable"
        datetime birthDate "nullable"
        string job "nullable"
        boolean suspended
        datetime emailVerified "nullable, 미인증시 null"
        datetime verifiedAt "관리자 신원확인, nullable"
        datetime deletedAt "탈퇴시점, nullable"
        enum gender "MALE, FEMALE, OTHER"
        enum preferredLocale "KO, EN"
        datetime createdAt
    }

    ROOM {
        string id PK
        string hostId FK
        string propertyId FK "nullable"
        string name
        string region
        string city "nullable"
        string district "nullable"
        string neighborhood "nullable"
        string legalDongCode "nullable"
        string roadAddress "nullable, 비공개"
        string jibunAddress "nullable, 비공개"
        string detailAddress "nullable, 비공개"
        float lat
        float lng
        boolean verifiedByHost
        float avgRating "캐시"
        int reviewCount "캐시"
        enum roomType "ONE_ROOM, SHARE_ROOM, WHOLE_HOUSE, APARTMENT (레거시)"
        enum rentalUnit "WHOLE, PRIVATE_ROOM, BED (신규, nullable)"
        enum buildingType "STUDIO, APARTMENT, OFFICETEL, HOUSE (nullable)"
        string sharedFacilities "SharedFacility[]"
        boolean classificationReviewRequired
        int capacity "nullable"
        int bedrooms "nullable"
        enum genderPolicy "ANY, MALE_ONLY, FEMALE_ONLY"
        int monthlyRent
        int deposit
        int cleaningFee
        int maintenanceFee
        int minStayMonths
        datetime availableFrom
        boolean petsAllowed
        boolean smokingAllowed
        boolean parking
        boolean published
        datetime createdAt
    }

    PROPERTY {
        string id PK
        string hostId FK
        string title
        string address
        string region
        string city
        string zipCode "nullable"
        float lat
        float lng
        int builtYear "nullable"
        int floors "nullable"
        datetime createdAt
    }

    HOST_PROFILE {
        string id PK
        string userId FK,UK
        string bio "nullable"
        boolean superhost
        int responseRate
        string payoutBank "nullable"
        string payoutAccount "nullable"
        datetime createdAt
    }

    IMAGE {
        string id PK
        string roomId FK
        string url
        int order
    }

    AMENITY {
        string id PK
        string key UK "wifi, parking, rooftop 등"
        string label
        string icon "nullable"
    }

    ROOM_AMENITY {
        string roomId FK
        string amenityId FK
    }

    CALENDAR_BLOCK {
        string id PK
        string roomId FK
        datetime date
        boolean blocked
        string reason "nullable"
    }

    RESERVATION {
        string id PK
        string roomId FK
        string guestId FK "대표자, 결제자"
        string companionId FK "동반 룸메이트, nullable"
        enum companionStatus "PENDING, ACCEPTED, DECLINED, nullable"
        datetime companionRespondedAt "nullable"
        datetime checkIn
        datetime checkOut
        datetime originalCheckOut "nullable, 변경 이력 비교용"
        datetime actualCheckOut "nullable"
        int months
        enum status "PENDING_PAYMENT..EXTENSION_REQUESTED (9종)"
        enum bookingMode "UNIT, BED, WHOLE_ROOM"
        int reservedSpots
        int monthlyRent
        int deposit
        int cleaningFee
        int maintenanceFee
        int serviceFee
        int discount
        int totalDueNow
        int extensionMonths "nullable"
        datetime createdAt
    }

    RESERVATION_COMPANION_MEMBER {
        string id PK
        string reservationId FK
        string userId FK
        enum status "PENDING, ACCEPTED, DECLINED"
        datetime respondedAt "nullable"
        datetime createdAt
    }

    CONTRACT_CHANGE_REQUEST {
        string id PK
        string reservationId FK
        string requesterId
        enum type "EARLY_CHECKOUT, EXTENSION"
        enum status "HOST_REVIEW..COMPLETED (7종)"
        datetime originalCheckOut
        datetime requestedCheckOut
        int additionalRent
        int additionalMaintenance
        int additionalServiceFee
        int additionalAmount
        int estimatedRefund
        int depositDeduction
        int finalRefund "nullable"
        string rejectReason "nullable"
        string paymentProvider "nullable"
        string paymentTxnId "nullable"
        datetime paymentDeadline "nullable"
        datetime reviewedAt "nullable"
        datetime paidAt "nullable"
        datetime appliedAt "nullable"
        datetime actualCheckOut "nullable"
    }

    PAYMENT {
        string id PK
        string reservationId FK,UK
        string provider "TOSS | PORTONE | STRIPE"
        string providerTxnId
        int amount
        enum status "PENDING, PAID, REFUNDED, FAILED"
        datetime createdAt
    }

    REVIEW {
        string id PK
        string roomId FK
        string authorId FK
        int rating
        string body
        string hostReply "nullable"
        datetime createdAt
    }

    TENANT_REVIEW {
        string id PK
        string reservationId FK,UK
        string authorId FK "호스트"
        string tenantId FK "게스트"
        int rating
        string body
        datetime createdAt
    }

    SETTLEMENT {
        string id PK
        string reservationId FK,UK
        string hostId FK
        int grossAmount
        int commission
        int netAmount
        enum status "SCHEDULED, PAID, ON_HOLD"
        datetime scheduledFor
        datetime paidAt "nullable"
        datetime createdAt
    }

    WISHLIST {
        string id PK
        string userId FK
        string name "기본값: 찜 목록"
        datetime createdAt
    }

    FAVORITE {
        string id PK
        string userId FK
        string roomId FK
        string wishlistId FK "nullable"
        datetime createdAt
    }

    REFRESH_TOKEN {
        string id PK
        string userId FK
        string tokenHash
        datetime expiresAt
        datetime createdAt
    }

    PASSWORD_RESET_TOKEN {
        string id PK
        string userId FK
        string tokenHash UK
        datetime expiresAt
        datetime usedAt "nullable"
    }

    EMAIL_VERIFICATION_TOKEN {
        string id PK
        string userId FK
        string tokenHash UK
        datetime expiresAt
        datetime usedAt "nullable"
    }
```

**스키마에서 확인한 설계 의도 (코드 주석 기준)**
- `Room.propertyId`는 nullable — 독립 매물(Property 없이 등록된 Room)이 있을 수 있음.
- `roomType`(레거시) vs `rentalUnit`/`buildingType`(신규 3축 분류)이 공존 — 마이그레이션 중인 상태로 보임, 신규 필드는 nullable.
- `Reservation`은 `companionId`로 공동 예약(룸메이트) 지원 — 대표자가 결제, 동반자는 별도 동의(`CompanionStatus`) 필요.
- `Reservation.originalCheckOut` / `actualCheckOut`을 별도로 둬서 연장·조기퇴실 이력과 실제 값을 구분.
- `Payment`, `Settlement`, `TenantReview`는 모두 `Reservation`과 1:1(`@unique`) — 예약 1건당 각각 최대 1개.

⚠️ **`Coupon` 모델은 스키마에 존재하지만 다른 모델과 FK로 연결되어 있지 않습니다.** `Reservation.discount` 필드는 있는데 `couponId` 참조가 없어, 실제로는 사용되지 않거나 애플리케이션 레이어에서만 처리되는 것으로 보입니다 — 이전 초안 ERD에서 `RESERVATION }o--o| COUPON`으로 그렸던 관계는 실제 스키마에는 없습니다.

---

## 2. Community ERD

```mermaid
erDiagram
    ROOM ||--o{ POST : "board of"
    USER ||--o{ POST : writes
    POST ||--o{ COMMENT : has
    USER ||--o{ COMMENT : writes
    COMMENT ||--o{ COMMENT : replies_to
    ROOM ||--o{ CHAT_ROOM : has
    USER ||--o{ CHAT_ROOM : "guest of"
    USER ||--o{ CHAT_ROOM : "host of"
    CHAT_ROOM ||--o{ MESSAGE : has
    USER ||--o{ MESSAGE : sends
    USER ||--o{ FRIENDSHIP : "userA of"
    USER ||--o{ FRIENDSHIP : "userB of"
    USER ||--o{ DIRECT_CONVERSATION : "participantA of"
    USER ||--o{ DIRECT_CONVERSATION : "participantB of"
    DIRECT_CONVERSATION ||--o{ DIRECT_MESSAGE : has
    USER ||--o{ DIRECT_MESSAGE : sends
    USER ||--o| ROOMMATE_PREFERENCE : has
    USER ||--o{ NOTIFICATION : receives

    POST {
        string id PK
        string roomId FK "숙소(하우스) 게시판"
        string authorId FK
        enum category "NOTICE, EVENT, CHORE, MARKET, CHAT, SEEKING"
        enum status "OPEN, IN_PROGRESS, COMPLETED, CLOSED"
        string title
        string body
        boolean pinned
        json lifestyleSnapshot "nullable"
        string sharedLifestyleFields "string[]"
        datetime deletedAt "nullable, 관리자 소프트삭제"
        datetime createdAt
        datetime updatedAt
    }

    COMMENT {
        string id PK
        string postId FK
        string authorId FK
        string parentId FK "nullable, 대댓글"
        string body
        datetime deletedAt "nullable, 관리자 소프트삭제"
        datetime createdAt
        datetime updatedAt
    }

    CHAT_ROOM {
        string id PK
        string roomId FK
        string guestId FK
        string hostId FK
        string hiddenBy "string[]"
        datetime createdAt
    }

    MESSAGE {
        string id PK
        string chatRoomId FK
        string senderId FK
        string body "nullable"
        string imageUrl "nullable, S3/CloudFront"
        string readBy "string[]"
        datetime createdAt
    }

    FRIENDSHIP {
        string id PK
        string userAId FK
        string userBId FK
        datetime createdAt
    }

    DIRECT_CONVERSATION {
        string id PK
        string participantAId FK
        string participantBId FK
        string hiddenBy "string[]"
        datetime createdAt
        datetime updatedAt
    }

    DIRECT_MESSAGE {
        string id PK
        string conversationId FK
        string senderId FK
        string body "nullable"
        string imageUrl "nullable"
        string readBy "string[]"
        datetime createdAt
    }

    ROOMMATE_PREFERENCE {
        string id PK
        string userId FK,UK
        enum noise "QUIET, MODERATE, LIVELY"
        enum cleanliness "VERY_TIDY, MODERATE, RELAXED"
        enum smoking "NON_SMOKING_ONLY, OUTDOOR_OK, SMOKING_OK"
        enum pets "NO_PETS, CONDITIONAL, PETS_OK"
        enum visitors "PRIOR_AGREEMENT, OCCASIONAL_OK, FREQUENT_OK"
        enum sleep "EARLY_BIRD, FLEXIBLE, NIGHT_OWL"
        enum sociability "PRIVATE, BALANCED, SOCIAL"
        enum sharedSpace "MINIMAL, MODERATE, COMMUNAL"
        enum drinking "NON_DRINKER, SOCIAL_DRINKER, FREQUENT"
        string intro "nullable, 자유서술"
        string keywords "string[], 규칙기반 추출"
        boolean isCompleted
        datetime createdAt
        datetime updatedAt
    }

    NOTIFICATION {
        string id PK
        string userId FK
        enum type "COMMENT, ROOM_APPROVED...RESERVATION (레거시 포함 20종)"
        string title
        string body
        boolean read
        string targetUrl "nullable"
        datetime createdAt
    }
```

**설계 포인트**
- `Post.roomId`는 "이 숙소(하우스)의 게시판"을 의미 — 입주자 커뮤니티 게시판 구조. `Comment`는 "💬 N replies" UI에 대응.
- `Friendship`, `DirectConversation`은 코드 주석상 `userAId/userBId`를 **정렬해서 저장** — 중복 관계 방지용 관례.
- `ROOMMATE_PREFERENCE`는 User와 1:1(`@unique`) — 온보딩 설문, `/match` 알고리즘 진입 조건은 `isCompleted`.
- `NotificationType`에 `MESSAGE`, `RESERVATION` 같은 "기존 알림 데이터 호환용" enum 값이 스키마 주석에 명시되어 있음 — 레거시 데이터 마이그레이션 흔적.

---

## 3. Ops·Admin ERD

```mermaid
erDiagram
    USER ||--o{ INQUIRY : submits
    USER ||--o{ REPORT : "reports (reporter)"
    USER ||--o{ REPORT : "reported (nullable)"

    INQUIRY {
        string id PK
        string authorId FK
        string title
        string body
        enum status "RECEIVED, IN_PROGRESS, RESOLVED"
        string answer "nullable"
        datetime answeredAt "nullable"
        string answeredBy "nullable, 운영자 식별자(문자열)"
        datetime createdAt
        datetime updatedAt
    }

    REPORT {
        string id PK
        string reporterId FK
        string reportedUserId FK "nullable, onDelete SetNull"
        enum targetType "ROOM, REVIEW, USER, MESSAGE, COMMUNITY_POST, COMMUNITY_COMMENT"
        string targetId "다형 참조, FK 아님"
        string reason
        enum status "RECEIVED, IN_REVIEW, RESOLVED"
        datetime reporterNotifiedAt "nullable"
        datetime reportedNotifiedAt "nullable"
        datetime resolvedNotifiedAt "nullable"
        datetime resolvedAt "nullable"
        datetime createdAt
    }

    NOTICE {
        string id PK
        string title
        string body
        boolean pinned
        datetime createdAt
        datetime updatedAt
    }

    BANNER {
        string id PK
        string title
        string color
        string position
        string linkUrl "nullable"
        string imageUrl "nullable"
        boolean active
        int order
        datetime createdAt
        datetime updatedAt
    }
```

**설계 포인트**
- `Report.targetType` + `targetId`로 다형 참조(polymorphic) — ROOM/REVIEW/USER/MESSAGE/게시글/댓글을 하나의 신고 테이블로 통합. `targetId`는 실제 FK 제약이 없는 문자열입니다.
- `Report.answeredBy`(Inquiry)는 관리자 테이블과 FK로 연결돼 있지 않고 **문자열**로만 저장 — 별도 `Admin` 모델이 스키마에 없고, `User.role = ADMIN`으로 관리자를 구분하는 구조입니다. 앞서 초안에서 그렸던 `ADMIN_ROLE`/`PERMISSION` RBAC 테이블은 실제 스키마에는 없습니다.
- `Notice`, `Banner`는 특정 유저와 관계없는 서비스 단위 콘텐츠 — FK 없음.

---

## 이전 초안과의 주요 차이

| 항목 | 이전 초안(추정) | 실제 스키마 |
|---|---|---|
| PK 타입 | bigint auto-increment | `String @id @default(cuid())` |
| 관리자 권한 | ADMIN_ROLE/PERMISSION RBAC | `User.role` enum(GUEST/HOST/ADMIN)만 존재, 별도 Admin 테이블 없음 |
| 쿠폰 | Reservation과 FK 연결 | 스키마상 고아 테이블(연결 없음) |
| 커뮤니티 | 플랫폼 전역 게시판 | `Room`(하우스) 단위 게시판 |
| 예약 | 개인 예약만 | 공동 예약(companion), 계약변경(연장/조기퇴실) 지원 |
| 채팅 | 없음 | 숙소 문의용 `ChatRoom` + 별도 `DirectConversation`(1:1 DM) 이원화 |
| 추가 도메인 | — | 룸메이트 매칭 설문(`RoommatePreference`), 입주자 평가(`TenantReview`), 정산(`Settlement`) |

---

## README 최신화 관련 메모

레포 README에는 백엔드 배포처가 **Railway**로 적혀 있는데, 실제로는 **Render**를 쓰고 계신 것으로 보입니다 (공유해주신 Render 대시보드 링크 기준). README 업데이트 시 이 부분도 함께 고치는 걸 권장드립니다. 원하시면 README 원문을 가져와서 배포 섹션만 정정해드릴 수 있어요.
