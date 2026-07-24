-- Add the new three-axis room classification without removing the legacy RoomType.
-- Existing listing ids, reservations, reviews and payment history are preserved.
-- Guards make this migration safe when a development DB already has part of the
-- schema from an interrupted/manual attempt. Prisma still records it only once.
DO $$
BEGIN
  CREATE TYPE "RentalUnit" AS ENUM ('WHOLE', 'PRIVATE_ROOM', 'BED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "BuildingType" AS ENUM ('STUDIO', 'APARTMENT', 'HOUSE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SharedFacility" AS ENUM ('BATHROOM', 'KITCHEN', 'LIVING_ROOM', 'LAUNDRY_ROOM', 'ENTRANCE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "BookingMode" AS ENUM ('UNIT', 'BED', 'WHOLE_ROOM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Room"
  ADD COLUMN IF NOT EXISTS "rentalUnit" "RentalUnit",
  ADD COLUMN IF NOT EXISTS "buildingType" "BuildingType",
  ADD COLUMN IF NOT EXISTS "sharedFacilities" "SharedFacility"[] NOT NULL DEFAULT ARRAY[]::"SharedFacility"[],
  ADD COLUMN IF NOT EXISTS "classificationReviewRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Reservation"
  ADD COLUMN IF NOT EXISTS "bookingMode" "BookingMode" NOT NULL DEFAULT 'UNIT',
  ADD COLUMN IF NOT EXISTS "reservedSpots" INTEGER NOT NULL DEFAULT 1;

-- Only the unambiguous legacy category is fully classified automatically.
-- Do not overwrite a classification that a host already confirmed.
UPDATE "Room"
SET
  "rentalUnit" = 'WHOLE',
  "buildingType" = 'HOUSE',
  "classificationReviewRequired" = false
WHERE "roomType" = 'WHOLE_HOUSE'
  AND "rentalUnit" IS NULL
  AND "buildingType" IS NULL;

-- A partially applied/manual classification must not look complete.
UPDATE "Room"
SET "classificationReviewRequired" = true
WHERE "roomType" = 'WHOLE_HOUSE'
  AND ("rentalUnit" IS NULL OR "buildingType" IS NULL);

-- Preserve reliable building hints, but do not guess the rentable unit.
UPDATE "Room"
SET
  "buildingType" = COALESCE("buildingType", 'STUDIO'),
  "classificationReviewRequired" = CASE
    WHEN "rentalUnit" IS NULL THEN true
    ELSE "classificationReviewRequired"
  END
WHERE "roomType" = 'ONE_ROOM';

UPDATE "Room"
SET
  "buildingType" = COALESCE("buildingType", 'APARTMENT'),
  "classificationReviewRequired" = CASE
    WHEN "rentalUnit" IS NULL THEN true
    ELSE "classificationReviewRequired"
  END
WHERE "roomType" = 'APARTMENT';

UPDATE "Room"
SET "classificationReviewRequired" = true
WHERE "roomType" = 'SHARE_ROOM'
  AND ("rentalUnit" IS NULL OR "buildingType" IS NULL);

CREATE INDEX IF NOT EXISTS "Room_rentalUnit_idx" ON "Room"("rentalUnit");
CREATE INDEX IF NOT EXISTS "Room_buildingType_idx" ON "Room"("buildingType");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Reservation_reservedSpots_check'
      AND conrelid = '"Reservation"'::regclass
  ) THEN
    ALTER TABLE "Reservation"
      ADD CONSTRAINT "Reservation_reservedSpots_check"
      CHECK ("reservedSpots" >= 1);
  END IF;
END $$;
