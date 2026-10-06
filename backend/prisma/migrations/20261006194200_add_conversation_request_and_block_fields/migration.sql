-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "blockedAt" TIMESTAMP(3),
ADD COLUMN     "blockedById" TEXT,
ADD COLUMN     "declineCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "declinedAt" TIMESTAMP(3);
