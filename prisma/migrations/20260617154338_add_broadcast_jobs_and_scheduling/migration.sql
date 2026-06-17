-- CreateEnum
CREATE TYPE "BroadcastType" AS ENUM ('BROADCAST', 'MULTICAST');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'LINE_BROADCAST_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'LINE_MULTICAST_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'LINE_FOLLOW_RECEIVED';
ALTER TYPE "AuditAction" ADD VALUE 'LINE_UNFOLLOW_RECEIVED';
ALTER TYPE "AuditAction" ADD VALUE 'LINE_UNSEND_RECEIVED';
ALTER TYPE "AuditAction" ADD VALUE 'LINE_BROADCAST_SCHEDULED';

-- CreateTable
CREATE TABLE "broadcast_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lineChannelId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "type" "BroadcastType" NOT NULL,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'PENDING',
    "recipientCount" INTEGER,
    "messages" JSONB NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "broadcast_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broadcast_jobs_tenantId_idx" ON "broadcast_jobs"("tenantId");

-- CreateIndex
CREATE INDEX "broadcast_jobs_lineChannelId_idx" ON "broadcast_jobs"("lineChannelId");

-- CreateIndex
CREATE INDEX "broadcast_jobs_status_scheduledAt_idx" ON "broadcast_jobs"("status", "scheduledAt");

-- AddForeignKey
ALTER TABLE "broadcast_jobs" ADD CONSTRAINT "broadcast_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_jobs" ADD CONSTRAINT "broadcast_jobs_lineChannelId_fkey" FOREIGN KEY ("lineChannelId") REFERENCES "line_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_jobs" ADD CONSTRAINT "broadcast_jobs_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
