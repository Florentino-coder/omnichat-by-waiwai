-- CreateEnum
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentSource" AS ENUM ('TEXT', 'FILE');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_DOCUMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_DOCUMENT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_DOCUMENT_INGESTED';
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_DOCUMENT_INGEST_FAILED';

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lineChannelId" TEXT,
    "title" TEXT NOT NULL,
    "sourceType" "KnowledgeDocumentSource" NOT NULL DEFAULT 'TEXT',
    "mimeType" TEXT,
    "storageKey" TEXT,
    "rawText" TEXT NOT NULL,
    "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_documents_tenantId_idx" ON "knowledge_documents"("tenantId");

-- CreateIndex
CREATE INDEX "knowledge_documents_tenantId_status_idx" ON "knowledge_documents"("tenantId", "status");

-- CreateIndex
CREATE INDEX "knowledge_documents_tenantId_lineChannelId_idx" ON "knowledge_documents"("tenantId", "lineChannelId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_tenantId_idx" ON "knowledge_chunks"("tenantId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_documentId_idx" ON "knowledge_chunks"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_documentId_chunkIndex_key" ON "knowledge_chunks"("documentId", "chunkIndex");

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_lineChannelId_fkey" FOREIGN KEY ("lineChannelId") REFERENCES "line_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
