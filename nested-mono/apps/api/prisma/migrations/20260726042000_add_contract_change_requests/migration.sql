-- 계약 변경 요청(조기 퇴실·연장)의 날짜, 금액, 검토 및 결제 이력을 저장한다.
CREATE TYPE "ContractChangeType" AS ENUM ('EARLY_CHECKOUT', 'EXTENSION');

CREATE TYPE "ContractChangeStatus" AS ENUM (
  'HOST_REVIEW',
  'PAYMENT_PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'COMPLETED'
);

ALTER TABLE "Reservation"
  ADD COLUMN "originalCheckOut" TIMESTAMP(3),
  ADD COLUMN "actualCheckOut" TIMESTAMP(3);

UPDATE "Reservation"
SET "originalCheckOut" = "checkOut"
WHERE "originalCheckOut" IS NULL;

CREATE TABLE "ContractChangeRequest" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "type" "ContractChangeType" NOT NULL,
  "status" "ContractChangeStatus" NOT NULL DEFAULT 'HOST_REVIEW',
  "originalCheckOut" TIMESTAMP(3) NOT NULL,
  "requestedCheckOut" TIMESTAMP(3) NOT NULL,
  "additionalRent" INTEGER NOT NULL DEFAULT 0,
  "additionalMaintenance" INTEGER NOT NULL DEFAULT 0,
  "additionalServiceFee" INTEGER NOT NULL DEFAULT 0,
  "additionalAmount" INTEGER NOT NULL DEFAULT 0,
  "estimatedRefund" INTEGER NOT NULL DEFAULT 0,
  "depositDeduction" INTEGER NOT NULL DEFAULT 0,
  "finalRefund" INTEGER,
  "rejectReason" TEXT,
  "paymentProvider" TEXT,
  "paymentTxnId" TEXT,
  "paymentDeadline" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "actualCheckOut" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContractChangeRequest_reservationId_createdAt_idx"
  ON "ContractChangeRequest"("reservationId", "createdAt");

CREATE INDEX "ContractChangeRequest_reservationId_status_idx"
  ON "ContractChangeRequest"("reservationId", "status");

CREATE INDEX "ContractChangeRequest_status_paymentDeadline_idx"
  ON "ContractChangeRequest"("status", "paymentDeadline");

ALTER TABLE "ContractChangeRequest"
  ADD CONSTRAINT "ContractChangeRequest_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
