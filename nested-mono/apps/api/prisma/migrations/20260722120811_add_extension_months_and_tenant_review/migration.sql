-- Contract extension: months requested (null = no extension pending).
ALTER TABLE "Reservation" ADD COLUMN "extensionMonths" INTEGER;

-- Host → tenant reviews (one per reservation).
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

CREATE UNIQUE INDEX "TenantReview_reservationId_key" ON "TenantReview"("reservationId");
CREATE INDEX "TenantReview_tenantId_idx" ON "TenantReview"("tenantId");
CREATE INDEX "TenantReview_authorId_idx" ON "TenantReview"("authorId");

ALTER TABLE "TenantReview" ADD CONSTRAINT "TenantReview_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantReview" ADD CONSTRAINT "TenantReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantReview" ADD CONSTRAINT "TenantReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
