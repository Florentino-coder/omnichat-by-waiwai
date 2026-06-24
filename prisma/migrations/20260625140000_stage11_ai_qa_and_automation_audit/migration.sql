-- Stage 11: AI QA scores + automation AI reply audit action

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AUTOMATION_AI_REPLY_SENT';

CREATE TABLE "ai_qa_scores" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "relevance_score" INTEGER NOT NULL,
    "tone_score" INTEGER NOT NULL,
    "hallucination_score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_qa_scores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_qa_scores_tenant_id_idx" ON "ai_qa_scores"("tenant_id");
CREATE INDEX "ai_qa_scores_conversation_id_idx" ON "ai_qa_scores"("conversation_id");
CREATE INDEX "ai_qa_scores_created_at_idx" ON "ai_qa_scores"("created_at");

ALTER TABLE "ai_qa_scores" ADD CONSTRAINT "ai_qa_scores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_qa_scores" ADD CONSTRAINT "ai_qa_scores_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_qa_scores" ADD CONSTRAINT "ai_qa_scores_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
