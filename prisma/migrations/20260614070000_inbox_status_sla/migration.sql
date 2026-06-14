ALTER TABLE "tenant_settings"
ADD COLUMN IF NOT EXISTS "inProgressAlertMinutes" INTEGER NOT NULL DEFAULT 10;

ALTER TABLE "conversations"
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'OPEN',
ADD COLUMN IF NOT EXISTS "inProgressStartedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "conversations_status_idx" ON "conversations"("status");
CREATE INDEX IF NOT EXISTS "conversations_inProgressStartedAt_idx" ON "conversations"("inProgressStartedAt");
