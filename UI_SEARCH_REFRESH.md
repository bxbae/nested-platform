# Nested 메인·숙소검색 UI 개편

## 반영 내용
- 메뉴를 중앙 정렬하고 숙소 검색 드롭다운을 `전체 숙소 / 개인실·원룸 / 쉐어룸 / 독채 / 직장 근처 / 검증된 숙소` 구조로 개편
- 메인 검색을 `직장 또는 목적지 / 입주 기간 / 주거 형태`로 분리
- 목적지 클릭 시 주요 업무지역, 입주 기간 클릭 시 달력만 표시
- 새 코리빙 이미지 `public/hero-coliving.jpg` 적용
- 메인 바로가기 3개 연결
  - 짧은 출근 시간 → `/browse`
  - 마음 맞는 룸메이트 → `/match`
  - 안심하고 편리한 주거 → `/search?verified=true`
- 인기 지역을 구 단위로 표시하고 영문 지역명을 한국어로 변환
- 검색 필터를 구 단위로 개편하고 활성 필터 칩 추가
- 호스트 확인 숙소 필터를 프론트·백엔드 검색 API에 연결
- 직장 근처 숙소 화면 문구와 태그를 한국어화

## 적용 후 확인
```bash
cd coliving
npm run build

cd ../nested-mono/apps/api
npx prisma generate
npm run build
```

`verified=true`는 `Room.verifiedByHost=true`이면서 관리자가 공개한(`published=true`) 숙소만 검색합니다.
