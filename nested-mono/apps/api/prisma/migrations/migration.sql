-- 평점/리뷰 개수 캐시 컬럼. 검색 목록에서 Review를 매번 집계하지 않도록
-- 리뷰가 달릴 때(reviews.module.ts create()) 갱신된다.
ALTER TABLE "Room" ADD COLUMN "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Room" ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;

-- 컬럼을 추가한 시점 기준으로, 이미 존재하는 리뷰들을 반영해 초기값을
-- 채운다 — 이걸 안 하면 새로 리뷰가 달리기 전까지 기존 방들은 전부
-- 평점 0/리뷰 0으로 보이게 된다.
UPDATE "Room" r
SET
  "avgRating" = COALESCE(agg.avg_rating, 0),
  "reviewCount" = COALESCE(agg.review_count, 0)
FROM (
  SELECT "roomId", AVG("rating")::float AS avg_rating, COUNT(*)::int AS review_count
  FROM "Review"
  GROUP BY "roomId"
) agg
WHERE r.id = agg."roomId";
