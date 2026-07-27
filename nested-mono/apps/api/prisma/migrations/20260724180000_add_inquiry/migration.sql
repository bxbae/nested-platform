-- 고객센터 문의
CREATE TYPE "InquiryStatus" AS ENUM ('RECEIVED', 'IN_PROGRESS', 'RESOLVED');

CREATE TABLE "Inquiry" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "InquiryStatus" NOT NULL DEFAULT 'RECEIVED',
  "answer" TEXT,
  "answeredAt" TIMESTAMP(3),
  "answeredBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Inquiry_authorId_createdAt_idx" ON "Inquiry"("authorId", "createdAt");

ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 답변 알림 타입
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INQUIRY_ANSWERED';
