-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "RetentionType" AS ENUM ('PERMANENT', 'TEMPORARY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MessageType" ADD VALUE 'IMAGE';
ALTER TYPE "MessageType" ADD VALUE 'VIDEO';
ALTER TYPE "MessageType" ADD VALUE 'AUDIO';
ALTER TYPE "MessageType" ADD VALUE 'FILE';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "mediaFileName" TEXT,
ADD COLUMN     "mediaMimeType" TEXT,
ADD COLUMN     "mediaR2Key" TEXT,
ADD COLUMN     "mediaSize" INTEGER,
ADD COLUMN     "mediaUrl" TEXT;

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "r2Key" TEXT NOT NULL,
    "publicUrl" TEXT,
    "retentionType" "RetentionType" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "files_tenantId_idx" ON "files"("tenantId");

-- CreateIndex
CREATE INDEX "files_expiresAt_idx" ON "files"("expiresAt");

-- CreateIndex
CREATE INDEX "files_retentionType_expiresAt_idx" ON "files"("retentionType", "expiresAt");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
