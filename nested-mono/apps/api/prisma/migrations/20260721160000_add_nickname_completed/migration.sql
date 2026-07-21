-- Public nickname onboarding state.
ALTER TABLE "User" ADD COLUMN "nicknameCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Existing password accounts already chose the displayed name during signup.
UPDATE "User"
SET "nicknameCompleted" = true
WHERE "passwordHash" IS NOT NULL;

-- Existing social accounts must confirm a privacy-safe public nickname once.
UPDATE "User"
SET "nicknameCompleted" = false
WHERE "provider" IS NOT NULL;
