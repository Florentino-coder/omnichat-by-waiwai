-- Stage 2: LINE OA integration

CREATE TYPE "MessageSource" AS ENUM ('LINE');
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'UNKNOWN');

ALTER TYPE "AuditAction" ADD VALUE 'LINE_CHANNEL_CONNECTED';
ALTER TYPE "AuditAction" ADD VALUE 'LINE_CHANNEL_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LINE_CHANNEL_DISCONNECTED';
ALTER TYPE "AuditAction" ADD VALUE 'LINE_MESSAGE_RECEIVED';
ALTER TYPE "AuditAction" ADD VALUE 'LINE_REPLY_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'LINE_WEBHOOK_FAILED';

CREATE TABLE "line_channels" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "lineChannelId" TEXT NOT NULL,
  "encryptedChannelSecret" TEXT NOT NULL,
  "encryptedChannelAccessToken" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastWebhookAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "line_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversations" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "lineChannelId" TEXT NOT NULL,
  "source" "MessageSource" NOT NULL DEFAULT 'LINE',
  "externalThreadId" TEXT NOT NULL,
  "displayName" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messages" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "lineChannelId" TEXT NOT NULL,
  "direction" "MessageDirection" NOT NULL,
  "source" "MessageSource" NOT NULL DEFAULT 'LINE',
  "type" "MessageType" NOT NULL DEFAULT 'TEXT',
  "externalMessageId" TEXT,
  "text" TEXT,
  "rawPayload" JSONB,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "line_channels_tenantId_lineChannelId_key"
  ON "line_channels"("tenantId", "lineChannelId");
CREATE INDEX "line_channels_tenantId_idx" ON "line_channels"("tenantId");
CREATE INDEX "line_channels_workspaceId_idx" ON "line_channels"("workspaceId");
CREATE INDEX "line_channels_lineChannelId_idx" ON "line_channels"("lineChannelId");

CREATE UNIQUE INDEX "conversations_tenantId_source_externalThreadId_key"
  ON "conversations"("tenantId", "source", "externalThreadId");
CREATE INDEX "conversations_tenantId_idx" ON "conversations"("tenantId");
CREATE INDEX "conversations_workspaceId_idx" ON "conversations"("workspaceId");
CREATE INDEX "conversations_lineChannelId_idx" ON "conversations"("lineChannelId");
CREATE INDEX "conversations_lastMessageAt_idx" ON "conversations"("lastMessageAt");

CREATE UNIQUE INDEX "messages_lineChannelId_externalMessageId_key"
  ON "messages"("lineChannelId", "externalMessageId");
CREATE INDEX "messages_tenantId_idx" ON "messages"("tenantId");
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");
CREATE INDEX "messages_lineChannelId_idx" ON "messages"("lineChannelId");
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");

ALTER TABLE "line_channels"
  ADD CONSTRAINT "line_channels_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "line_channels"
  ADD CONSTRAINT "line_channels_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_lineChannelId_fkey"
  FOREIGN KEY ("lineChannelId") REFERENCES "line_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages"
  ADD CONSTRAINT "messages_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages"
  ADD CONSTRAINT "messages_lineChannelId_fkey"
  FOREIGN KEY ("lineChannelId") REFERENCES "line_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "line_channels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
