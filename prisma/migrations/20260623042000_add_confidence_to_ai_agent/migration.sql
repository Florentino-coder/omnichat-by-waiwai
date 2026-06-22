-- AlterTable
ALTER TABLE "ai_suggestions" ADD COLUMN     "confidence" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "ai_auto_reply_confidence_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.80;
