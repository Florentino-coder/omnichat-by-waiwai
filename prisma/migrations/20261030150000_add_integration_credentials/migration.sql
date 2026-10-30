-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('TERMWAI');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'INTEGRATION_CONNECTED';
ALTER TYPE "AuditAction" ADD VALUE 'INTEGRATION_DISCONNECTED';
ALTER TYPE "AuditAction" ADD VALUE 'INTEGRATION_LOOKUP';

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "encrypted_api_key" TEXT NOT NULL,
    "key_last4" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_credentials_tenant_id_idx" ON "integration_credentials"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_tenant_id_provider_key" ON "integration_credentials"("tenant_id", "provider");

-- AddForeignKey
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "integration_credentials" ENABLE ROW LEVEL SECURITY;
