ALTER TABLE "Room"
ADD COLUMN "city" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "neighborhood" TEXT,
ADD COLUMN "legalDongCode" TEXT,
ADD COLUMN "roadAddress" TEXT,
ADD COLUMN "jibunAddress" TEXT,
ADD COLUMN "detailAddress" TEXT,
ADD COLUMN "zipCode" TEXT;

CREATE INDEX "Room_district_idx"
ON "Room"("district");

CREATE INDEX "Room_neighborhood_idx"
ON "Room"("neighborhood");

CREATE INDEX "Room_legalDongCode_idx"
ON "Room"("legalDongCode");

CREATE INDEX "Room_district_legalDongCode_idx"
ON "Room"("district", "legalDongCode");
