-- AlterTable
ALTER TABLE "slip_verifications" ADD COLUMN "qr_decoded_raw" TEXT,
ADD COLUMN "qr_decode_status" VARCHAR(50) DEFAULT 'NOT_ATTEMPTED',
ADD COLUMN "verify_provider" VARCHAR(50),
ADD COLUMN "verify_payload" JSONB,
ADD COLUMN "slipok_cost_charged" BOOLEAN DEFAULT false;
