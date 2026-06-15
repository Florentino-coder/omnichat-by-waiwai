-- Stage 3 infrastructure checkpoint: composite indexes for inbox read paths.
-- Apply only during an approved migration window against the intended DB target.

CREATE INDEX "conversations_tenantId_deletedAt_lastMessageAt_idx"
ON "conversations"("tenantId", "deletedAt", "lastMessageAt");

CREATE INDEX "conversations_tenantId_status_deletedAt_lastMessageAt_idx"
ON "conversations"("tenantId", "status", "deletedAt", "lastMessageAt");

CREATE INDEX "conversations_tenantId_assignedToMemberId_deletedAt_lastMessageAt_idx"
ON "conversations"("tenantId", "assignedToMemberId", "deletedAt", "lastMessageAt");

CREATE INDEX "messages_tenantId_conversationId_deletedAt_createdAt_idx"
ON "messages"("tenantId", "conversationId", "deletedAt", "createdAt");
