-- User self-reported gender. Required at signup going forward; existing rows
-- are backfilled to OTHER so the NOT NULL column can be added safely.
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

ALTER TABLE "User" ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'OTHER';
