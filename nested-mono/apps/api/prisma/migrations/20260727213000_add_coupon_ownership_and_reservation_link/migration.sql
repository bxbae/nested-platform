-- 쿠폰 소유권과 예약 사용 이력을 연결한다.
-- 기존 데이터는 유지하며 nullable 컬럼과 인덱스만 추가한다.
ALTER TABLE "Coupon"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "ownerId" TEXT;

ALTER TABLE "Reservation"
  ADD COLUMN "couponId" TEXT;

UPDATE "Coupon"
SET "kind" = 'BIRTHDAY'
WHERE "code" LIKE 'BDAY-%';

CREATE INDEX "Coupon_ownerId_idx" ON "Coupon"("ownerId");
CREATE INDEX "Coupon_kind_validTo_idx" ON "Coupon"("kind", "validTo");
CREATE INDEX "Reservation_couponId_idx" ON "Reservation"("couponId");

ALTER TABLE "Coupon"
  ADD CONSTRAINT "Coupon_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "Coupon"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
