-- AlterEnum
ALTER TYPE "KnowledgeDocumentSource" ADD VALUE 'URL';

-- AlterTable
ALTER TABLE "knowledge_documents" ADD COLUMN "sourceUrl" TEXT;
