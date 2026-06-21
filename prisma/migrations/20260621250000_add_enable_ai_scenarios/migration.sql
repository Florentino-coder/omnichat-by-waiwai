-- AlterTable (idempotent — safe if column already exists from a partial deploy)
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "enable_ai_scenarios" BOOLEAN NOT NULL DEFAULT true;
