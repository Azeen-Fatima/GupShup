-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chatLockPinHash" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "disappearingMode" TEXT NOT NULL DEFAULT 'off';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatLock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "peerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ChatLock_userId_peerUserId_key" ON "ChatLock"("userId", "peerUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChatLock_userId_idx" ON "ChatLock"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChatLock_peerUserId_idx" ON "ChatLock"("peerUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_expiresAt_idx" ON "Message"("expiresAt");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatLock_userId_fkey') THEN
        ALTER TABLE "ChatLock" ADD CONSTRAINT "ChatLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatLock_peerUserId_fkey') THEN
        ALTER TABLE "ChatLock" ADD CONSTRAINT "ChatLock_peerUserId_fkey" FOREIGN KEY ("peerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
