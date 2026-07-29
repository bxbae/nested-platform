-- 룸메이트 초대별 개별 결제 상태와 결제 기한을 저장한다.
-- 기존 예약/회원/결제 데이터는 삭제하거나 다시 청구하지 않는다.
ALTER TYPE "CompanionStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
ALTER TYPE "CompanionStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "CompanionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "ReservationCompanionMember"
  ADD COLUMN "requiresIndividualPayment" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "inviteExpiresAt" TIMESTAMP(3),
  ADD COLUMN "paymentDeadline" TIMESTAMP(3),
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "expiredAt" TIMESTAMP(3),
  ADD COLUMN "monthlyRent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deposit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cleaningFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maintenanceFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "serviceFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totalDueNow" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "paymentProvider" TEXT,
  ADD COLUMN "paymentTxnId" TEXT;

-- 기존 초대는 대표자가 이미 전체 금액을 결제했을 수 있으므로
-- 개별 결제 대상으로 전환하지 않는다. 새 코드로 생성되는 초대만 true가 된다.

CREATE INDEX "ReservationCompanionMember_status_inviteExpiresAt_idx"
  ON "ReservationCompanionMember"("status", "inviteExpiresAt");
CREATE INDEX "ReservationCompanionMember_status_paymentDeadline_idx"
  ON "ReservationCompanionMember"("status", "paymentDeadline");
CREATE INDEX "ReservationCompanionMember_individualPayment_status_idx"
  ON "ReservationCompanionMember"("requiresIndividualPayment", "status");
