-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'AI_SCENARIO_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'AI_SCENARIO_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'AI_SCENARIO_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'AI_SCENARIO_MATCHED';

-- CreateTable
CREATE TABLE "ai_scenarios" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lineChannelId" TEXT,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "triggerTagNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activeHourStart" INTEGER,
    "activeHourEnd" INTEGER,
    "instructions" TEXT NOT NULL,
    "actionAddTagName" TEXT,
    "actionAssignMemberId" TEXT,
    "actionSetPriority" "ConversationPriority",
    "actionEscalate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ai_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_scenarios_tenantId_idx" ON "ai_scenarios"("tenantId");
CREATE INDEX "ai_scenarios_tenantId_isEnabled_idx" ON "ai_scenarios"("tenantId", "isEnabled");
CREATE INDEX "ai_scenarios_tenantId_lineChannelId_idx" ON "ai_scenarios"("tenantId", "lineChannelId");

-- AddForeignKey
ALTER TABLE "ai_scenarios" ADD CONSTRAINT "ai_scenarios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_scenarios" ADD CONSTRAINT "ai_scenarios_lineChannelId_fkey" FOREIGN KEY ("lineChannelId") REFERENCES "line_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "ai_scenarios" ENABLE ROW LEVEL SECURITY;
