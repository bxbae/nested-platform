-- CreateEnum
CREATE TYPE "CompanionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "companionId" TEXT,
ADD COLUMN     "companionRespondedAt" TIMESTAMP(3),
ADD COLUMN     "companionStatus" "CompanionStatus";

-- CreateIndex
CREATE INDEX "Reservation_companionId_idx" ON "Reservation"("companionId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
