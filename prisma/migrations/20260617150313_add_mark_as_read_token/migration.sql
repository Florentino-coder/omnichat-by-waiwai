-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'LINE_MARK_AS_READ';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "markAsReadToken" TEXT;
