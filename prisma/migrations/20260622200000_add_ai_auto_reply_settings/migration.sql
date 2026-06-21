-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "AiAutoReplyMode" AS ENUM ('OFF', 'WHEN_UNASSIGNED', 'ALWAYS', 'OFF_HOURS_ONLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable (idempotent)
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "enable_ai_auto_reply" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "ai_auto_reply_mode" "AiAutoReplyMode" NOT NULL DEFAULT 'OFF_HOURS_ONLY';
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "ai_auto_reply_business_hour_start" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "ai_auto_reply_business_hour_end" INTEGER NOT NULL DEFAULT 23;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "ai_auto_reply_instructions" TEXT;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "ai_escalation_keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill default escalation keywords for existing rows (empty array only)
UPDATE "tenant_settings"
SET "ai_escalation_keywords" = ARRAY[
  'แอดมิน',
  'คุยกับคน',
  'โทรหา',
  'ติดต่อเจ้าหน้าที่',
  'ขอคุยกับคน',
  'พูดกับคน',
  'ฝ่ายบริการ',
  'โทร'
]::TEXT[]
WHERE cardinality("ai_escalation_keywords") = 0;

-- AuditAction AI auto-reply events
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_AUTO_REPLY_SENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_AUTO_REPLY_SKIPPED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_AUTO_REPLY_ESCALATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_AUTO_REPLY_FAILED';
