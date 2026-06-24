-- CreateEnum
CREATE TYPE "BackupRunType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'VERIFICATION', 'MANUAL');

-- CreateEnum
CREATE TYPE "BackupRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'BACKUP_RUN_TRIGGERED';
ALTER TYPE "AuditAction" ADD VALUE 'BACKUP_RUN_SUCCEEDED';
ALTER TYPE "AuditAction" ADD VALUE 'BACKUP_RUN_FAILED';

-- CreateTable
CREATE TABLE "backup_runs" (
    "id" TEXT NOT NULL,
    "runType" "BackupRunType" NOT NULL,
    "status" "BackupRunStatus" NOT NULL DEFAULT 'RUNNING',
    "r2Key" TEXT,
    "bucket" TEXT NOT NULL,
    "sizeBytes" BIGINT,
    "errorMessage" TEXT,
    "triggeredByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backup_runs_status_idx" ON "backup_runs"("status");

-- CreateIndex
CREATE INDEX "backup_runs_runType_idx" ON "backup_runs"("runType");

-- CreateIndex
CREATE INDEX "backup_runs_startedAt_idx" ON "backup_runs"("startedAt");

-- AddForeignKey
ALTER TABLE "backup_runs" ADD CONSTRAINT "backup_runs_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
