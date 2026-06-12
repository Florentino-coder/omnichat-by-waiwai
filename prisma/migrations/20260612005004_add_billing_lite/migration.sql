/*
  Warnings:

  - Made the column `planId` on table `tenants` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PLAN_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'PLAN_LIMIT_EXCEEDED';
ALTER TYPE "AuditAction" ADD VALUE 'USAGE_THRESHOLD_REACHED';

-- Backfill existing tenants before making planId required.
UPDATE "tenants" SET "planId" = 'free' WHERE "planId" IS NULL;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ALTER COLUMN "planId" SET NOT NULL,
ALTER COLUMN "planId" SET DEFAULT 'free';

-- CreateTable
CREATE TABLE "plan_limits" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "maxWorkspaces" INTEGER NOT NULL,
    "maxAgents" INTEGER NOT NULL,
    "maxAiCreditsPerMonth" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_counters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "value" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_limits_planId_key" ON "plan_limits"("planId");

-- CreateIndex
CREATE INDEX "usage_counters_tenantId_idx" ON "usage_counters"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "usage_counters_tenantId_metric_periodStart_key" ON "usage_counters"("tenantId", "metric", "periodStart");

-- CreateIndex
CREATE INDEX "tenants_planId_idx" ON "tenants"("planId");

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supabase public schema hardening.
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
