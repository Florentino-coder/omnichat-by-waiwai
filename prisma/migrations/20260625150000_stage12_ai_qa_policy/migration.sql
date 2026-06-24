-- Stage 12: AI policy, QA review, guardrail notice, audit actions

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_POLICY_BLOCKED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_AUTO_REPLY_DISABLED_BY_GUARDRAIL';

ALTER TABLE "tenant_settings"
  ADD COLUMN IF NOT EXISTS "ai_policy_blocked_topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "ai_guardrail_notice_at" TIMESTAMPTZ;

ALTER TABLE "ai_qa_scores"
  ADD COLUMN IF NOT EXISTS "review_note" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ;
