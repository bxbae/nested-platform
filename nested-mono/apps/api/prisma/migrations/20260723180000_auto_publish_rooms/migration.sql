-- 신규 숙소를 승인 절차 없이 즉시 공개 상태로 등록
ALTER TABLE "Room" ALTER COLUMN "published" SET DEFAULT true;

-- 기존 승인 대기 숙소도 일괄 공개
UPDATE "Room" SET "published" = true WHERE "published" = false;
