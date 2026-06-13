-- Stage 3: richer LINE inbox details and multi-OA conversation identity

ALTER TYPE "AuditAction" ADD VALUE 'CONVERSATION_CUSTOMER_RENAMED';
ALTER TYPE "MessageType" ADD VALUE 'STICKER';

ALTER TABLE "line_channels"
  ADD COLUMN "badgeColor" TEXT NOT NULL DEFAULT '#4f46e5';

ALTER TABLE "conversations"
  ADD COLUMN "nickname" TEXT;

DROP INDEX "conversations_tenantId_source_externalThreadId_key";

CREATE UNIQUE INDEX "conversations_tenantId_source_lineChannelId_externalThreadId_key"
  ON "conversations"("tenantId", "source", "lineChannelId", "externalThreadId");
