-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "guestHiddenAt" TIMESTAMP(3),
ADD COLUMN     "legacyCompanionHiddenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ReservationCompanionMember" ADD COLUMN     "hiddenAt" TIMESTAMP(3);
