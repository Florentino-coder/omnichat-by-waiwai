import { AuditAction } from "@prisma/client";
import { actionsForCategory, isAuditLogCategory } from "./audit-action-categories";

describe("audit-action-categories", () => {
  it("recognizes valid categories", () => {
    expect(isAuditLogCategory("ai")).toBe(true);
    expect(isAuditLogCategory("unknown")).toBe(false);
  });

  it("maps ai category to auto-reply actions", () => {
    const actions = actionsForCategory("ai");
    expect(actions).toContain(AuditAction.AI_AUTO_REPLY_SENT);
    expect(actions).toContain(AuditAction.AUTOMATION_AI_REPLY_SENT);
  });
});
