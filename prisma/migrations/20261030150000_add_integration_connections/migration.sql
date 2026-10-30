-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'INTEGRATION_CONNECTED';
ALTER TYPE "AuditAction" ADD VALUE 'INTEGRATION_DISCONNECTED';
ALTER TYPE "AuditAction" ADD VALUE 'INTEGRATION_LOOKUP';
ALTER TYPE "AuditAction" ADD VALUE 'INTEGRATION_TESTED';
ALTER TYPE "AuditAction" ADD VALUE 'INTEGRATION_SECRET_ROTATED';

-- AlterTable
ALTER TABLE "plan_limits" ADD COLUMN     "maxIntegrations" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "encrypted_secret" TEXT NOT NULL,
    "encrypted_previous_secret" TEXT,
    "previous_secret_expires_at" TIMESTAMP(3),
    "last_tested_at" TIMESTAMP(3),
    "last_test_ok" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_key_id_key" ON "integration_connections"("key_id");

-- CreateIndex
CREATE INDEX "integration_connections_tenant_id_idx" ON "integration_connections"("tenant_id");

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "integration_connections" ENABLE ROW LEVEL SECURITY;
