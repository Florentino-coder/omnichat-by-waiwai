-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "enable_ai_suggest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ai_provider" TEXT NOT NULL DEFAULT 'gemini';
