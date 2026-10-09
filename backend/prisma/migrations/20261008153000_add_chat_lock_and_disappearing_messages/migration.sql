-- AlterTable
ALTER TABLE "User" ADD COLUMN "chatLockPinHash" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "disappearingMode" TEXT NOT NULL DEFAULT 'off';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ChatLock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "peerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatLock_userId_peerUserId_key" ON "ChatLock"("userId", "peerUserId");

-- CreateIndex
CREATE INDEX "ChatLock_userId_idx" ON "ChatLock"("userId");

-- CreateIndex
CREATE INDEX "ChatLock_peerUserId_idx" ON "ChatLock"("peerUserId");

-- CreateIndex
CREATE INDEX "Message_expiresAt_idx" ON "Message"("expiresAt");

-- AddForeignKey
ALTER TABLE "ChatLock" ADD CONSTRAINT "ChatLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatLock" ADD CONSTRAINT "ChatLock_peerUserId_fkey" FOREIGN KEY ("peerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
