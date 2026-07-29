-- CreateEnum
CREATE TYPE "GenderVisibility" AS ENUM ('PUBLIC', 'MATCHED_ONLY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "RoommateGenderPreference" AS ENUM ('ANY', 'MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "genderVisibility" "GenderVisibility" NOT NULL DEFAULT 'MATCHED_ONLY',
ADD COLUMN     "roommateGenderPreference" "RoommateGenderPreference" NOT NULL DEFAULT 'ANY';
