-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REPORT';

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "reportedNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "reportedUserId" TEXT,
ADD COLUMN     "reporterNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

-- CreateIndex
CREATE INDEX "Report_reportedUserId_idx" ON "Report"("reportedUserId");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
