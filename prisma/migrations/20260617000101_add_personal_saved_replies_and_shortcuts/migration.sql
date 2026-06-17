-- DropIndex
DROP INDEX "conversations_inProgressStartedAt_idx";

-- DropIndex
DROP INDEX "conversations_status_idx";

-- AlterTable
ALTER TABLE "saved_replies" ADD COLUMN     "hotkeyBinding" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "shortcutKey" TEXT,
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "saved_replies_tenantId_userId_shortcutKey_idx" ON "saved_replies"("tenantId", "userId", "shortcutKey");

-- AddForeignKey
ALTER TABLE "saved_replies" ADD CONSTRAINT "saved_replies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "conversations_tenantId_assignedToMemberId_deletedAt_lastMessage" RENAME TO "conversations_tenantId_assignedToMemberId_deletedAt_lastMes_idx";

-- RenameIndex
ALTER INDEX "conversations_tenantId_source_lineChannelId_externalThreadId_ke" RENAME TO "conversations_tenantId_source_lineChannelId_externalThreadI_key";
