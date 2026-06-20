-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_ARTICLE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_ARTICLE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'KNOWLEDGE_ARTICLE_DELETED';

-- CreateTable
CREATE TABLE "knowledge_articles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lineChannelId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_articles_tenantId_idx" ON "knowledge_articles"("tenantId");
CREATE INDEX "knowledge_articles_tenantId_isActive_idx" ON "knowledge_articles"("tenantId", "isActive");
CREATE INDEX "knowledge_articles_tenantId_lineChannelId_idx" ON "knowledge_articles"("tenantId", "lineChannelId");

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_lineChannelId_fkey" FOREIGN KEY ("lineChannelId") REFERENCES "line_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "knowledge_articles" ENABLE ROW LEVEL SECURITY;
