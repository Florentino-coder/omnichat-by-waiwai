-- AlterTable
ALTER TABLE "ai_suggestions" ADD COLUMN "citations" JSONB;

-- CreateIndex
CREATE INDEX "ai_suggestions_conversation_id_status_idx" ON "ai_suggestions"("conversation_id", "status");
