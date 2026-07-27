-- Add officetel as a first-class building type.
ALTER TYPE "BuildingType" ADD VALUE IF NOT EXISTS 'OFFICETEL';

-- Store one invitation row per selected friend while preserving the legacy
-- Reservation.companionId columns for existing reservations.
CREATE TABLE "ReservationCompanionMember" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "CompanionStatus" NOT NULL DEFAULT 'PENDING',
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReservationCompanionMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReservationCompanionMember_reservationId_userId_key"
  ON "ReservationCompanionMember"("reservationId", "userId");
CREATE INDEX "ReservationCompanionMember_userId_status_idx"
  ON "ReservationCompanionMember"("userId", "status");

ALTER TABLE "ReservationCompanionMember"
  ADD CONSTRAINT "ReservationCompanionMember_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReservationCompanionMember"
  ADD CONSTRAINT "ReservationCompanionMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing single-companion reservations so old invitations continue
-- to work through the new multi-companion relation.
INSERT INTO "ReservationCompanionMember" (
  "id",
  "reservationId",
  "userId",
  "status",
  "respondedAt",
  "createdAt"
)
SELECT
  'legacy_' || md5(r."id" || ':' || r."companionId"),
  r."id",
  r."companionId",
  COALESCE(r."companionStatus", 'PENDING'::"CompanionStatus"),
  r."companionRespondedAt",
  r."createdAt"
FROM "Reservation" r
WHERE r."companionId" IS NOT NULL
ON CONFLICT ("reservationId", "userId") DO NOTHING;
