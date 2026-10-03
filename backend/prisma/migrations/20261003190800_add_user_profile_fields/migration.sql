-- AlterTable
ALTER TABLE "User" ADD COLUMN "bio" TEXT,
ADD COLUMN "statusMessage" TEXT,
ADD COLUMN "themePreference" TEXT NOT NULL DEFAULT 'system';
