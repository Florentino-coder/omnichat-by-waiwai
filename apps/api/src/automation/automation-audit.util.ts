import { AuditAction, Prisma } from "@prisma/client";

export const AUTOMATION_SYSTEM_ACTOR = "automation";

export function buildAutomationAuditLog(
  tenantId: string,
  action: AuditAction,
  target: { targetType: string; targetId: string },
  metadata: Record<string, unknown> = {}
): Prisma.AuditLogUncheckedCreateInput {
  return {
    tenantId,
    userId: null,
    action,
    targetType: target.targetType,
    targetId: target.targetId,
    metadata: {
      ...metadata,
      triggeredBy: AUTOMATION_SYSTEM_ACTOR
    }
  };
}
