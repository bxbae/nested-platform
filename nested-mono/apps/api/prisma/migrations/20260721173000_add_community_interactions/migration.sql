-- Community interaction expansion
CREATE TYPE "PostStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CLOSED');
ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'COMMUNITY_POST';
ALTER TYPE "ReportTargetType" ADD VALUE IF NOT EXISTS 'COMMUNITY_COMMENT';
ALTER TABLE "Post" ADD COLUMN "status" "PostStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "lifestyleSnapshot" JSONB,
ADD COLUMN "sharedLifestyleFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Comment" ADD COLUMN "parentId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Post_category_status_idx" ON "Post"("category", "status");
CREATE INDEX "Comment_parentId_createdAt_idx" ON "Comment"("parentId", "createdAt");
