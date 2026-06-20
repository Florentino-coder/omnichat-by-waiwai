-- CreateEnum
CREATE TYPE "AutomationTriggerType" AS ENUM ('MESSAGE_RECEIVED', 'CONVERSATION_CREATED', 'TAG_ADDED', 'STATUS_CHANGED', 'OFF_HOURS');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'AUTOMATION_RULE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'AUTOMATION_RULE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'AUTOMATION_RULE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'AUTOMATION_RUN_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'AUTOMATION_STEP_EXECUTED';
ALTER TYPE "AuditAction" ADD VALUE 'AUTOMATION_RUN_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'AUTOMATION_RUN_FAILED';

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lineChannelId" TEXT,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" "AutomationTriggerType" NOT NULL,
    "triggerKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "triggerTagNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "triggerStatus" TEXT,
    "offHourStart" INTEGER,
    "offHourEnd" INTEGER,
    "steps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'PENDING',
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "context" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_rules_tenantId_idx" ON "automation_rules"("tenantId");
CREATE INDEX "automation_rules_tenantId_isEnabled_idx" ON "automation_rules"("tenantId", "isEnabled");
CREATE INDEX "automation_rules_tenantId_triggerType_idx" ON "automation_rules"("tenantId", "triggerType");
CREATE INDEX "automation_rules_tenantId_lineChannelId_idx" ON "automation_rules"("tenantId", "lineChannelId");

-- CreateIndex
CREATE INDEX "automation_runs_tenantId_idx" ON "automation_runs"("tenantId");
CREATE INDEX "automation_runs_tenantId_conversationId_idx" ON "automation_runs"("tenantId", "conversationId");
CREATE INDEX "automation_runs_tenantId_ruleId_idx" ON "automation_runs"("tenantId", "ruleId");
CREATE INDEX "automation_runs_status_idx" ON "automation_runs"("status");

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_lineChannelId_fkey" FOREIGN KEY ("lineChannelId") REFERENCES "line_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "automation_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "automation_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_runs" ENABLE ROW LEVEL SECURITY;
