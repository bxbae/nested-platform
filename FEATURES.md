# Nested — 역할별 기능 정의서 / 작업 배분

> **Nested는 이미 상당 부분 구현돼 있습니다.**
> **상태** 열을 반드시 확인하세요. ✅는 이미 동작합니다. **다시 만들지 마세요.**
>
> ⚠️ **2026-07-31 재점검 완료.** 이전 버전은 실제 코드 상태와 크게 어긋나 있었습니다
> (특히 매칭·회원·호스트·관리자 영역 대부분이 🔴로 표기돼 있었으나 실제로는 구현 완료).
> 백엔드 라우트(`@Controller`/`@Get`/`@Post`/...), 프론트 페이지 파일 내용을
> 코드에서 직접 확인해서 대조했습니다. 소켓 게이트웨이 존재 여부, 프론트 소스
> 코드 내 실제 API 호출 로직(mock 아님)까지 전부 확인 완료 — **🟡 항목 없이
> 전면 재점검 완료**된 버전입니다.

**상태 표기**
- ✅ **완료** — 실제 API 연동, 동작함
- 🟡 **연결 필요 / 확인 필요** — 백엔드는 있는데 화면 연동 여부 미확인, 혹은 부분 구현
- 🔴 **미구현** — 백엔드 없음 → **풀스택 작업**

---

## 역할 분담

| 역할 | 담당 영역 | 담당 백엔드 모듈 | 담당자 |
|---|---|---|---|
| **A. AI 엔지니어** | 추천·매칭 | (구현 완료, 고도화 단계) | |
| **B. 회원/프로필 풀스택** | 인증·계정·프로필·알림 | `auth`, `notifications` | |
| **C. 주거 등록/관리 풀스택** | 호스트·숙소 등록·관리자 | `rooms`, `admin`, `storage`, `host` | |
| **D. 검색/상세/상호작용 풀스택** | 검색·예약·메시지·커뮤니티 | `reservations`, `messages`, `chat`, `community`, `favorites` | |
| **E. 총괄/통합** | 아키텍처·인프라·통합·리뷰 | 전체 | 배병환 |

---

# A. AI 엔지니어 — 매칭/추천

## A-1. 성향 데이터 (완료)

| 기능명 | 기능 설명 | 상태 |
|---|---|---|
| 성향 데이터 스키마 | `RoommatePreference` 모델 (9개 축) | ✅ |
| 성향 설문 | `GET/PUT /me/preference` + `/me/preference` 페이지 | ✅ |
| 성향 수정 | 동일 엔드포인트로 재제출 가능 | ✅ |

## A-2. 룸메이트 매칭 (완료)

| 기능명 | 기능 설명 | 상태 |
|---|---|---|
| 매칭 알고리즘 | `scoreMatch()` — 9축 균등 가중치(각 1/9) + 3축(흡연/반려동물/방문객) 하드필터 | ✅ |
| 매칭 화면 | `/match` 페이지, `GET /match`, `GET /match/:userId` | ✅ |
| 매칭 이유 표시 | `MATCH_REASONS`(일치 사유) / `ADJUSTMENT_REASONS`(조율 필요 사유) | ✅ |
| 성별 상호 매칭 필터 | `isMutuallyGenderCompatible()` | ✅ |

> **참고 — 현재 알고리즘 스펙 (기준점):**
> - 9개 축 전부 동일 가중치. 축 간 차등 가중치 없음.
> - `smoking`/`pets`/`visitors` 3개 축은 답변 차이가 2단계(완전 반대)면
>   나머지 궁합과 무관하게 매칭 자체가 차단됨(하드필터).
> - 나머지 6개 축은 점수에만 반영(차단 없음): gap 0→1점, gap 1→0.5점, gap 2→0점.
> - 최종 점수 = round((총점 / 9) × 100)
>
> 고도화하려면(축별 차등 가중치, 하드필터 축 조정 등) 이 스펙을 기준으로 diff를 잡으세요.

## A-3. 숙소 추천 (미구현 — 다음 단계)

| 기능명 | 기능 설명 | 상태 | 우선순위 |
|---|---|---|---|
| 개인화 숙소 추천 | 성향·검색 이력 기반 |  ✅ | - |
| 추천 이유 표시 | 추천 근거를 자연어로 설명 |  ✅ | - |
| 유사 숙소 추천 | `findSimilar()` + 상세 페이지 `similarRooms` 병렬 fetch 및 렌더링 확인 | ✅ | - |

---

# B. 회원 / 프로필 풀스택

## B-1. 인증 (완료)

| 기능명 | 상태 |
|---|---|
| 로컬/소셜 회원가입·로그인 | ✅ |
| 자동 로그인 / 로그아웃 | ✅ |
| 내 정보 조회 `GET /auth/me` | ✅ |

## B-2. 프로필 (완료)

| 기능명 | 기능 설명 | 상태 |
|---|---|---|
| 프로필 수정 | `PATCH /auth/me` | ✅ |
| 비밀번호 변경 | `POST /auth/change-password` | ✅ |
| 회원 탈퇴 | `DELETE /auth/me` | ✅ |
| 비밀번호 찾기 | `POST /auth/forgot-password`, `/auth/reset-password` | ✅ |
| 설정 페이지 | `/me/settings` — 비밀번호 변경·회원 탈퇴·호스트 권한 포기 전부 실제 API 연결 확인(`changePassword()`, `deleteAccount()`, `relinquishHost()`) | ✅ |
| **호스트 권한 포기** (신규 발견) | 확인 문구 입력 후 호스트→게스트 전환, 예약·리뷰 없는 숙소는 삭제·있는 숙소는 비공개 전환 | ✅ |

## B-3. 알림

| 기능명 | 기능 설명 | 상태 |
|---|---|---|
| 알림 조회/읽음 처리 | 목록, 개별/전체 읽음 | ✅ |
| 알림 삭제 | `DELETE /notifications/:id` | ✅ |
| 실시간 알림 | `notifications.gateway.ts`(`@WebSocketGateway`) + 프론트 `NotificationBell.tsx`, `lib/api/socket.ts` 연결 확인 | ✅ |
| 알림 클릭 이동 | `NotificationBell.tsx`에 포함 확인 | ✅ |

## B-4. 마이페이지

| 기능명 | 기능 설명 | 상태 |
|---|---|---|
| 내 프로필 화면 | ✅ |
| 내 리뷰 목록 | `GET /reviews/mine`(게스트)/`received`(호스트) 명확히 분리 확인. 프론트는 `/me/activity`로 통합(레거시 `/me/reviews`는 리다이렉트) | ✅ |
| 뱃지 | `GET /users/:id/badges`, `/me/badges` — `host/reservations` 페이지에서 실제 사용 확인 | ✅ |

---

# C. 주거 등록 / 관리 풀스택

## C-1. 숙소 등록 (완료 — 설계 의도 유지, 변경 금지 사항 기존과 동일)

## C-2. 호스트 기능 (대부분 완료)

| 기능명 | 기능 설명 | 상태 |
|---|---|---|
| 문의함, 리뷰 관리 | ✅ |
| 숙소 수정 | `PATCH /rooms/:id` + 프론트 `saveEdit()`/`deleteRoom()`, 사진 업로드까지 실동작 확인 | ✅ |
| 예약 관리 | `GET /reservations/host` + 승인/거절/노쇼/조기퇴실/연장/입주자 리뷰까지 실동작 확인 | ✅ |
| 호스트 대시보드 | `GET /host/dashboard` | ✅ |
| 캘린더 | `host-calendar.module.ts` (block/block-range) | ✅ |
| **수익 CSV 내보내기** (신규 발견, 문서에 없었음) | `GET /host/export/revenue.csv`, `/tenants.csv` | ✅ |
| **연체 관리** (신규 발견) | `host-overdue.module.ts` | ✅ |
| **정산** (신규 발견) | `GET /host/settlements` | ✅ |

## C-3. 관리자

| 기능명 | 기능 설명 | 상태 |
|---|---|---|
| 숙소 승인/거부 | ✅ |
| 회원 관리 | `PATCH /admin/members/:id/{verify,role,suspend}` + 프론트 `verifyMember()`/`suspendMember()` optimistic update 확인 | ✅ |
| 신고 관리 | `PATCH /admin/reports/:id` + 프론트 상태 플로우(`NEXT_STATUS`) 확인 | ✅ |
| 관리자 대시보드 | `GET /admin/stats` + 프론트 `AdminStats` 타입 실데이터 렌더링 확인 | ✅ |
| 통계/매출 차트 | `GET /admin/revenue/monthly`, `/admin/revenue-trend-v2` | ✅ |
| 공지/배너 | `admin/notices`, `admin/banners` CRUD 전체 + reorder | ✅ |
| 쿠폰 관리 | `admin/coupons` CRUD 전체 | ✅ |
| 휴지통(트래시) | `admin/trash`, 게시글/댓글 복원 | ✅ (신규 발견) |

---

# D. 검색 / 상세 / 상호작용 풀스택

## D-1. 검색/탐색 (완료)

| 기능명 | 상태 |
|---|---|
| 검색, 상세, 지도, 찜하기 | ✅ |
| 정렬 / 페이지네이션 | `SearchView.tsx` — `SortKey`, `PAGE_SIZE`, `buildPaginationItems()`, `useSearchProperties` 훅 확인 | ✅ |

## D-2. 예약/결제

| 기능명 | 기능 설명 | 상태 |
|---|---|
| 예약 견적/생성/취소, 결제 승인 | ✅ |
| 내 여행 목록 | `/trips`(`TripsList` 단독) vs `/me/trips`(`TripsList` + `CompanionInvites` 조합) — 중복 아닌 의도된 역할 분리로 확인 | ✅ |
| 결제 내역 | `/me/payments`가 `listMyPayments()`(`lib/api/reservations.ts`) 직접 호출 확인 | ✅ |
| 쿠폰 발급/관리 | `admin/coupons`, `me/coupons`, `me/birthday-coupon` | ✅ |

## D-3. 메시지/커뮤니티

| 기능명 | 기능 설명 | 상태 |
|---|---|
| 채팅방 개설, 메시지 목록/전송 | ✅ |
| 커뮤니티 글/댓글 | ✅ |
| 실시간 메시지 | `chat.gateway.ts`, `message-events.gateway.ts` + 프론트 `useChatRoom.ts`, `MessageBell.tsx` 연결 확인 | ✅ |
| 읽음 처리 | 백엔드 `readBy` 배열 로직(다이렉트+채팅방 전체) + 프론트 `chat-store.ts`, `ChatView.tsx` 연결 확인 | ✅ |
| 이미지 전송 | `ChatView.tsx` — FileReader 업로드(`send({ imageUrl })`), 수신 렌더링, 리스트 프리뷰("📷 사진")까지 확인 | ✅ |

---

# 신규 발견 도메인 (기존 문서에 전혀 없었음)

이전 FEATURES.md 작성 이후 추가된 것으로 보이는 모듈들입니다. 담당자 재배정이 필요합니다.

| 모듈 | 라우트 | 상태 | 비고 |
|---|---|---|---|
| `friends` | `/friends`, 친구 요청/수락/거절 | ✅ | 담당 역할 미지정 |
| `inquiries` | `/inquiries`, `/admin/inquiries` | ✅ | 담당 역할 미지정 |
| `transit` | `/transit` | ✅ | 다중 이동수단 API 관련 (README 참고) |
| `tenant-review` | 세입자 리뷰 + 뱃지 시스템 | ✅ | B-4 뱃지와 연결 가능성 |
| `users` | `GET /users/:id` | ✅ | 공개 프로필 조회 |
| `storage` | `presign`, `cloudinary-signature`, 삭제 | ✅ | 기존 문서에 있었음(C-1) |

---

## 재점검 완료

이번 재점검으로 발견됐던 🟡 항목 전부(설정/실시간/읽음/이미지전송/숙소수정/예약관리/정렬/유사숙소추천/내리뷰/뱃지/관리자3종/여행페이지/결제내역) 확정됐습니다. 문서상 🟡로 남은 항목은 없습니다.

## 남은 작업

1. **Prisma 스키마 전체 모델 목록과 이 문서 대조** (스키마가 실제 소스 오브 트루스)
2. **신규 발견 도메인**(`friends`, `inquiries`, `transit`, `tenant-review`, `users`) 담당 역할 재배정

## 참고 문서

- `ONBOARDING.md` — 로컬 실행, 구조, 뭐가 진짜/목업인지
- `ISSUES.md` — 상세 이슈 (⚠️ 이 문서도 함께 재점검 필요 — 매칭 이슈가 누락돼 있었음)
- `MIGRATION_RUNBOOK.md` — Prisma 마이그레이션 절차
