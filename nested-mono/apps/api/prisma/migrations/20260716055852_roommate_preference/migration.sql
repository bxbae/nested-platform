-- CreateEnum
CREATE TYPE "NoiseSensitivity" AS ENUM ('QUIET', 'MODERATE', 'LIVELY');

-- CreateEnum
CREATE TYPE "CleanlinessLevel" AS ENUM ('VERY_TIDY', 'MODERATE', 'RELAXED');

-- CreateEnum
CREATE TYPE "SmokingPreference" AS ENUM ('NON_SMOKING_ONLY', 'OUTDOOR_OK', 'SMOKING_OK');

-- CreateEnum
CREATE TYPE "PetPreference" AS ENUM ('NO_PETS', 'CONDITIONAL', 'PETS_OK');

-- CreateEnum
CREATE TYPE "VisitorPolicy" AS ENUM ('PRIOR_AGREEMENT', 'OCCASIONAL_OK', 'FREQUENT_OK');

-- CreateEnum
CREATE TYPE "SleepPattern" AS ENUM ('EARLY_BIRD', 'FLEXIBLE', 'NIGHT_OWL');

-- CreateEnum
CREATE TYPE "Sociability" AS ENUM ('PRIVATE', 'BALANCED', 'SOCIAL');

-- CreateEnum
CREATE TYPE "SharedSpaceStyle" AS ENUM ('MINIMAL', 'MODERATE', 'COMMUNAL');

-- CreateEnum
CREATE TYPE "DrinkingHabit" AS ENUM ('NON_DRINKER', 'SOCIAL_DRINKER', 'FREQUENT');

-- CreateTable
CREATE TABLE "RoommatePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "noise" "NoiseSensitivity" NOT NULL,
    "cleanliness" "CleanlinessLevel" NOT NULL,
    "smoking" "SmokingPreference" NOT NULL,
    "pets" "PetPreference" NOT NULL,
    "visitors" "VisitorPolicy" NOT NULL,
    "sleep" "SleepPattern" NOT NULL,
    "sociability" "Sociability" NOT NULL,
    "sharedSpace" "SharedSpaceStyle" NOT NULL,
    "drinking" "DrinkingHabit" NOT NULL,
    "intro" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoommatePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoommatePreference_userId_key" ON "RoommatePreference"("userId");

-- AddForeignKey
ALTER TABLE "RoommatePreference" ADD CONSTRAINT "RoommatePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
