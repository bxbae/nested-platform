-- AlterEnum
ALTER TYPE "ReservationStatus" ADD VALUE 'EXTENSION_REQUESTED';

-- DropIndex
DROP INDEX "Post_category_idx";

-- AlterTable
ALTER TABLE "Comment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "extensionMonths" INTEGER;

-- CreateTable
CREATE TABLE "TenantReview" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantReview_reservationId_key" ON "TenantReview"("reservationId");

-- CreateIndex
CREATE INDEX "TenantReview_tenantId_idx" ON "TenantReview"("tenantId");

-- CreateIndex
CREATE INDEX "TenantReview_authorId_idx" ON "TenantReview"("authorId");

-- AddForeignKey
ALTER TABLE "TenantReview" ADD CONSTRAINT "TenantReview_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantReview" ADD CONSTRAINT "TenantReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantReview" ADD CONSTRAINT "TenantReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
