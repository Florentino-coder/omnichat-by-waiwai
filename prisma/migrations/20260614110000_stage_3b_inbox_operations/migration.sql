-- Stage 3B: inbox assignment, priority, tags, internal notes, and saved replies

CREATE TYPE "ConversationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_UNASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_PRIORITY_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_TAG_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_TAG_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_TAG_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_TAG_ADDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_TAG_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_NOTE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_NOTE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SAVED_REPLY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SAVED_REPLY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SAVED_REPLY_DELETED';

ALTER TABLE "conversations"
  ADD COLUMN "priority" "ConversationPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "assignedToMemberId" TEXT;

CREATE TABLE "conversation_tags" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#64748b',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "conversation_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_tag_links" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "conversation_tag_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_internal_notes" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "authorMemberId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "conversation_internal_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saved_replies" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "saved_replies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversations_assignedToMemberId_idx" ON "conversations"("assignedToMemberId");
CREATE INDEX "conversations_priority_idx" ON "conversations"("priority");

CREATE UNIQUE INDEX "conversation_tags_tenantId_name_key" ON "conversation_tags"("tenantId", "name");
CREATE INDEX "conversation_tags_tenantId_idx" ON "conversation_tags"("tenantId");

CREATE UNIQUE INDEX "conversation_tag_links_conversationId_tagId_key"
  ON "conversation_tag_links"("conversationId", "tagId");
CREATE INDEX "conversation_tag_links_tenantId_idx" ON "conversation_tag_links"("tenantId");
CREATE INDEX "conversation_tag_links_tagId_idx" ON "conversation_tag_links"("tagId");

CREATE INDEX "conversation_internal_notes_tenantId_idx" ON "conversation_internal_notes"("tenantId");
CREATE INDEX "conversation_internal_notes_conversationId_idx" ON "conversation_internal_notes"("conversationId");
CREATE INDEX "conversation_internal_notes_authorMemberId_idx" ON "conversation_internal_notes"("authorMemberId");

CREATE INDEX "saved_replies_tenantId_idx" ON "saved_replies"("tenantId");

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_assignedToMemberId_fkey"
  FOREIGN KEY ("assignedToMemberId") REFERENCES "workspace_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "conversation_tags"
  ADD CONSTRAINT "conversation_tags_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversation_tag_links"
  ADD CONSTRAINT "conversation_tag_links_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_tag_links"
  ADD CONSTRAINT "conversation_tag_links_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_tag_links"
  ADD CONSTRAINT "conversation_tag_links_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "conversation_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversation_internal_notes"
  ADD CONSTRAINT "conversation_internal_notes_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_internal_notes"
  ADD CONSTRAINT "conversation_internal_notes_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_internal_notes"
  ADD CONSTRAINT "conversation_internal_notes_authorMemberId_fkey"
  FOREIGN KEY ("authorMemberId") REFERENCES "workspace_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "saved_replies"
  ADD CONSTRAINT "saved_replies_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversation_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_tag_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_internal_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_replies" ENABLE ROW LEVEL SECURITY;
