-- CreateEnum
CREATE TYPE "UserLocale" AS ENUM ('KO', 'EN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "preferredLocale" "UserLocale" NOT NULL DEFAULT 'KO';
