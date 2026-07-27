# 🏠 Nested Platform

> **공동주거(쉐어하우스) 예약 및 커뮤니티 플랫폼**

Nested Platform은 숙소 예약 서비스와 커뮤니티 기능을 하나의 플랫폼으로 통합한 웹 서비스입니다. 사용자는 숙소를 검색하고 예약할 수 있으며, 리뷰 작성, 친구 추가, 1:1 채팅, 공동 예약 등의 기능을 이용할 수 있습니다. 호스트는 숙소를 등록·관리하고, 관리자는 배너, 공지사항, 쿠폰 등 운영 기능을 수행할 수 있습니다.

---

# 📖 프로젝트 소개

기존 숙소 예약 서비스는 예약 기능에 집중되어 있는 반면, Nested Platform은 사용자 간의 커뮤니티와 소통 기능을 함께 제공하여 보다 풍부한 사용자 경험을 목표로 합니다.

본 프로젝트는 **Next.js**, **NestJS**, **Prisma ORM**, **PostgreSQL**을 기반으로 구축된 풀스택 웹 플랫폼입니다.

---

# ✨ 주요 기능

### 👤 사용자

* 회원가입 및 로그인
* 프로필 관리
* 친구 추가 및 관리
* 알림 기능

### 🏠 숙소

* 숙소 등록
* 숙소 수정 및 삭제
* 숙소 검색 및 필터링
* 숙소 이미지 관리
* 편의시설 및 이용 규칙 관리

### 📅 예약

* 예약 생성
* 예약 취소
* 예약 가능 일정 조회
* 공동 예약

### 💳 결제

* 결제 요청
* 결제 승인
* 쿠폰 적용

### ⭐ 리뷰

* 리뷰 작성
* 평점 등록
* 숙소 리뷰 조회

### 💬 커뮤니티

* 게시글 작성
* 댓글 작성
* 신고 기능

### 💌 실시간 소통

* 친구 관리
* 1:1 채팅
* 메시지 전송

### 🛠 관리자

* 배너 관리
* 공지사항 관리
* 쿠폰 관리
* 신고 관리
* 문의 관리
* 정산 관리

---

# 🛠 기술 스택

| Category   | Technology                 |
| ---------- | -------------------------- |
| Frontend   | Next.js, React, TypeScript |
| UI         | Tailwind CSS, shadcn/ui    |
| Backend    | NestJS                     |
| ORM        | Prisma                     |
| Database   | PostgreSQL (Neon)          |
| Deployment | Vercel                     |

---

# 🏗 시스템 아키텍처

```text
Client
   │
   ▼
Next.js (Frontend)
   │
REST API
   │
NestJS (Backend)
   │
Prisma ORM
   │
PostgreSQL (Neon)
```

> 시스템 아키텍처 상세 내용은 `docs/Architecture.md`를 참고하세요.

---

# 🗄 데이터베이스 구조

프로젝트는 Prisma ORM을 기반으로 데이터베이스를 설계하였으며 주요 도메인은 다음과 같습니다.

* User
* Room
* Reservation
* Payment
* Review
* Wishlist
* Coupon
* Banner
* Notice
* Post
* Comment
* Friendship
* DirectConversation
* DirectMessage
* Notification
* Settlement

> 자세한 ERD는 `docs/ERD.md`를 참고하세요.

---

# 🔌 API Summary

| Domain         | Endpoint           |
| -------------- | ------------------ |
| Authentication | `/auth/*`          |
| User           | `/users/*`         |
| Room           | `/rooms/*`         |
| Reservation    | `/reservations/*`  |
| Payment        | `/payments/*`      |
| Review         | `/reviews/*`       |
| Community      | `/posts/*`         |
| Chat           | `/messages/*`      |
| Notification   | `/notifications/*` |
| Admin          | `/admin/*`         |

> 상세 API 명세는 `docs/API.md`를 참고하세요.

---

# 📂 프로젝트 구조

```text
nested-platform
├── apps
│   ├── api
│   └── web
│
├── packages
│   ├── ui
│   └── shared
│
├── prisma
│
├── docs
│   ├── API.md
│   ├── Architecture.md
│   ├── Database.md
│   ├── ERD.md
│   └── Troubleshooting.md
│
└── README.md
```

---

# 🚀 실행 방법

## 저장소 복제

```bash
git clone https://github.com/bxbae/nested-platform.git
```

## 의존성 설치

```bash
npm install
```

## 환경 변수 설정

```env
DATABASE_URL=

NEXT_PUBLIC_API_URL=

NEXTAUTH_SECRET=
```

## 개발 서버 실행

```bash
npm run dev
```

---

# 🌐 배포

| Service  | Platform        |
| -------- | --------------- |
| Frontend | Vercel          |
| Database | Neon PostgreSQL |

---

# 📷 주요 화면

* 메인 페이지
* 숙소 검색
* 숙소 상세
* 예약 페이지
* 결제 페이지
* 커뮤니티
* 관리자 페이지

> 스크린샷은 `docs/images` 폴더에 추가할 예정입니다.

---

# 📌 프로젝트 특징

* 모듈 기반 NestJS 아키텍처
* Prisma ORM 기반 데이터 관리
* 재사용 가능한 UI 컴포넌트 구조
* 예약 및 결제 프로세스 분리
* 커뮤니티 및 실시간 소통 기능 통합
* 관리자 운영 기능 제공

---

# 📈 향후 개선 사항

* AI 기반 숙소 추천
* 실시간 채팅 기능 고도화
* 예약 통계 대시보드
* 다국어 지원
* 모바일 UI 최적화
* 관리자 분석 기능 강화

---

# 👨‍💻 Team

**Nested Platform**

Built with **Next.js · NestJS · Prisma · PostgreSQL**
