-- CreateTable
CREATE TABLE "slip_verifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT,
    "r2_image_key" TEXT NOT NULL,
    "ocr_text" TEXT,
    "bank_name" TEXT,
    "amount" DECIMAL(12,2),
    "transaction_ref" TEXT,
    "transfer_date" TIMESTAMP(3),
    "slip_score" INTEGER NOT NULL,
    "detect_status" TEXT NOT NULL DEFAULT 'DETECTED',
    "verify_status" TEXT NOT NULL DEFAULT 'PENDING',
    "intent" TEXT,
    "admin_action" TEXT,
    "admin_note" TEXT,
    "admin_member_id" TEXT,
    "acted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slip_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slip_verifications_tenant_id_idx" ON "slip_verifications"("tenant_id");

-- CreateIndex
CREATE INDEX "slip_verifications_conversation_id_idx" ON "slip_verifications"("conversation_id");

-- AddForeignKey
ALTER TABLE "slip_verifications" ADD CONSTRAINT "slip_verifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slip_verifications" ADD CONSTRAINT "slip_verifications_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
