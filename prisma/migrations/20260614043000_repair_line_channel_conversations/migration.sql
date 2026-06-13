-- Stage 3 repair: split pre-Checkpoint-I conversations that were merged across LINE OA channels.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

WITH mismatched_messages AS (
  SELECT
    m."id" AS "messageId",
    m."tenantId",
    m."lineChannelId",
    lc."workspaceId",
    c."source",
    c."externalThreadId",
    c."displayName",
    c."lastMessageAt",
    MIN(m."createdAt") AS "firstMessageAt",
    MAX(COALESCE(m."sentAt", m."createdAt")) AS "latestMessageAt"
  FROM "messages" m
  INNER JOIN "conversations" c ON c."id" = m."conversationId"
  INNER JOIN "line_channels" lc ON lc."id" = m."lineChannelId"
  WHERE
    m."deletedAt" IS NULL
    AND c."deletedAt" IS NULL
    AND lc."deletedAt" IS NULL
    AND m."lineChannelId" <> c."lineChannelId"
  GROUP BY
    m."id",
    m."tenantId",
    m."lineChannelId",
    lc."workspaceId",
    c."source",
    c."externalThreadId",
    c."displayName",
    c."lastMessageAt"
),
conversation_targets AS (
  SELECT
    mm."tenantId",
    mm."lineChannelId",
    mm."workspaceId",
    mm."source",
    mm."externalThreadId",
    MAX(mm."displayName") AS "displayName",
    MAX(mm."latestMessageAt") AS "latestMessageAt",
    MIN(mm."firstMessageAt") AS "firstMessageAt"
  FROM mismatched_messages mm
  GROUP BY
    mm."tenantId",
    mm."lineChannelId",
    mm."workspaceId",
    mm."source",
    mm."externalThreadId"
)
INSERT INTO "conversations" (
  "id",
  "tenantId",
  "workspaceId",
  "lineChannelId",
  "source",
  "externalThreadId",
  "displayName",
  "lastMessageAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  ct."tenantId",
  ct."workspaceId",
  ct."lineChannelId",
  ct."source",
  ct."externalThreadId",
  ct."displayName",
  ct."latestMessageAt",
  ct."firstMessageAt",
  NOW()
FROM conversation_targets ct
ON CONFLICT ("tenantId", "source", "lineChannelId", "externalThreadId") DO NOTHING;

UPDATE "messages" m
SET
  "conversationId" = target."id",
  "updatedAt" = NOW()
FROM "conversations" old_conversation
INNER JOIN "conversations" target
  ON target."tenantId" = old_conversation."tenantId"
  AND target."source" = old_conversation."source"
  AND target."externalThreadId" = old_conversation."externalThreadId"
  AND target."deletedAt" IS NULL
WHERE
  old_conversation."id" = m."conversationId"
  AND target."lineChannelId" = m."lineChannelId"
  AND m."deletedAt" IS NULL
  AND old_conversation."deletedAt" IS NULL
  AND m."lineChannelId" <> old_conversation."lineChannelId";

UPDATE "conversations" c
SET
  "lastMessageAt" = latest."latestMessageAt",
  "updatedAt" = NOW()
FROM (
  SELECT
    "conversationId",
    MAX(COALESCE("sentAt", "createdAt")) AS "latestMessageAt"
  FROM "messages"
  WHERE "deletedAt" IS NULL
  GROUP BY "conversationId"
) latest
WHERE c."id" = latest."conversationId";
