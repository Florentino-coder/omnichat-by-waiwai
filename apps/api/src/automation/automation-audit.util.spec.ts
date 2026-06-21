import { AuditAction } from "@prisma/client";
import {
  AUTOMATION_SYSTEM_ACTOR,
  buildAutomationAuditLog
} from "./automation-audit.util";

describe("buildAutomationAuditLog", () => {
  it("sets userId null and triggeredBy automation", () => {
    const log = buildAutomationAuditLog(
      "tenant-1",
      AuditAction.AUTOMATION_RUN_STARTED,
      { targetType: "AutomationRun", targetId: "run-1" },
      { ruleId: "rule-1" }
    );

    expect(log.userId).toBeNull();
    expect(log.tenantId).toBe("tenant-1");
    expect(log.action).toBe(AuditAction.AUTOMATION_RUN_STARTED);
    expect(log.metadata).toMatchObject({
      ruleId: "rule-1",
      triggeredBy: AUTOMATION_SYSTEM_ACTOR
    });
  });
});
