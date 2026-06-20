-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'AI_SUGGEST_FAILED';

-- AlterTable
ALTER TABLE "ai_suggestions" ADD COLUMN "provider" TEXT,
ADD COLUMN "latency_ms" INTEGER,
ADD COLUMN "error_code" TEXT;

-- CreateIndex
CREATE INDEX "ai_suggestions_created_at_idx" ON "ai_suggestions"("created_at");

-- CreateIndex
CREATE INDEX "ai_suggestions_provider_idx" ON "ai_suggestions"("provider");
