import { INestApplication } from "@nestjs/common";
import {
  AuditAction,
  MessageDirection,
  MessageType,
  PrismaClient,
  Role
} from "@prisma/client";
import request from "supertest";
import { createApiTestApp } from "./helpers/api-test-app";
import { createStage1Fixtures, Stage1Fixtures } from "./helpers/stage-1-fixtures";

jest.mock("otplib", () => ({
  OTP: class {
    generateSecret(): string {
      return "MOCKSECRET123456";
    }

    verifySync(options: { token: string }): { valid: boolean } {
      return { valid: options.token === "123456" };
    }

    generateURI(options: { issuer: string; label: string; secret: string }): string {
      return `otpauth://totp/${options.issuer}:${options.label}?secret=${options.secret}&issuer=${options.issuer}`;
    }
  }
}));

describe("Stage 1 tenant isolation e2e", () => {
  jest.setTimeout(120000);

  let app: INestApplication;
  let prisma: PrismaClient;
  let fixtures: Stage1Fixtures;

  beforeAll(async () => {
    app = await createApiTestApp();
    prisma = new PrismaClient();
    fixtures = await createStage1Fixtures(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  it("lists only Tenant A workspaces", async () => {
    const response = await authedGet("/api/v1/workspaces").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: fixtures.tenantA.workspaceId })
      ])
    );
    expect(JSON.stringify(response.body.data)).not.toContain(fixtures.tenantB.workspaceId);
  });

  it("does not expose Tenant B workspace by id", async () => {
    const tenantBWorkspacePath = `/api/v1/workspaces/${fixtures.tenantB.workspaceId}`;

    await authedGet(tenantBWorkspacePath).expect(404);
    await authedPatch(tenantBWorkspacePath, { name: "Cross Tenant Update" }).expect(404);
    await authedDelete(tenantBWorkspacePath).expect(404);
    await authedGet(`${tenantBWorkspacePath}/members`).expect(404);
    await authedPatch(
      `${tenantBWorkspacePath}/members/${fixtures.tenantB.users[Role.AGENT].id}`,
      { role: Role.QC }
    ).expect(404);
    await authedDelete(
      `${tenantBWorkspacePath}/members/${fixtures.tenantB.users[Role.AGENT].id}`
    ).expect(404);
  });

  it("keeps invitations tenant-scoped", async () => {
    const response = await authedGet("/api/v1/invitations").expect(200);

    expect(JSON.stringify(response.body.data)).toContain(fixtures.tenantA.invitationId);
    expect(JSON.stringify(response.body.data)).not.toContain(fixtures.tenantB.invitationId);
    await authedDelete(`/api/v1/invitations/${fixtures.tenantB.invitationId}`).expect(404);
  });

  it("keeps audit logs tenant-scoped", async () => {
    const response = await authedGet("/api/v1/audit-logs").expect(200);

    expect(JSON.stringify(response.body.data)).toContain(fixtures.tenantA.auditLogId);
    expect(JSON.stringify(response.body.data)).not.toContain(fixtures.tenantB.auditLogId);
  });

  it("keeps inbox conversations and messages tenant-scoped", async () => {
    const tenantAInbox = await createInboxFixture("tenant-a", fixtures.tenantA);
    const tenantBInbox = await createInboxFixture("tenant-b", fixtures.tenantB);

    const conversations = await authedGet("/api/v1/inbox/conversations").expect(200);
    expect(conversations.body.success).toBe(true);
    expect(JSON.stringify(conversations.body.data)).toContain(tenantAInbox.conversationId);
    expect(JSON.stringify(conversations.body.data)).toContain("Tenant A inbox message");
    expect(JSON.stringify(conversations.body.data)).not.toContain(
      tenantBInbox.conversationId
    );
    expect(JSON.stringify(conversations.body.data)).not.toContain("Tenant B inbox message");

    const messages = await authedGet(
      `/api/v1/inbox/conversations/${tenantAInbox.conversationId}/messages`
    ).expect(200);
    expect(messages.body.success).toBe(true);
    expect(JSON.stringify(messages.body.data)).toContain("Tenant A inbox message");

    await authedGet(
      `/api/v1/inbox/conversations/${tenantBInbox.conversationId}/messages`
    ).expect(404);
  });

  it("keeps tenant settings and plan scoped to Tenant A", async () => {
    const settings = await authedGet("/api/v1/tenants/me/settings").expect(200);
    expect(settings.body.data.tenantId).toBe(fixtures.tenantA.tenantId);

    const updatedSettings = await authedPatch("/api/v1/tenants/me/settings", {
      timezone: "Asia/Bangkok"
    }).expect(200);
    expect(updatedSettings.body.data.tenantId).toBe(fixtures.tenantA.tenantId);

    const plan = await authedGet("/api/v1/tenants/me/plan").expect(200);
    expect(plan.body.data.tenant.id).toBe(fixtures.tenantA.tenantId);

    const updatedPlan = await authedPatch("/api/v1/tenants/me/plan", {
      planId: "pro"
    }).expect(200);
    expect(updatedPlan.body.data.tenant.id).toBe(fixtures.tenantA.tenantId);
  });

  it("rejects workspace creation at plan limit and writes Tenant A audit only", async () => {
    await prisma.tenant.update({
      where: { id: fixtures.tenantA.tenantId },
      data: { planId: "free" }
    });
    const beforeCount = await prisma.workspace.count({
      where: { tenantId: fixtures.tenantA.tenantId, deletedAt: null }
    });

    const response = await authedPost("/api/v1/workspaces", {
      name: "Over Limit Workspace"
    }).expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("PLAN_LIMIT_EXCEEDED");
    await expectTenantWorkspaceCount(fixtures.tenantA.tenantId, beforeCount);
    await expectPlanLimitAudit(fixtures.tenantA.tenantId, "Workspace");
    await expectNoPlanLimitAudit(fixtures.tenantB.tenantId, "Workspace");
  });

  it("rejects invitation accept at max agent limit without changing Tenant B", async () => {
    await prisma.tenant.update({
      where: { id: fixtures.tenantA.tenantId },
      data: { planId: "free" }
    });
    const tenantBMembersBefore = await prisma.workspaceMember.count({
      where: { tenantId: fixtures.tenantB.tenantId, isActive: true }
    });
    const email = `limit-agent-${Date.now()}@omnichat.local`;
    const token = `limit-agent-${Date.now()}`;
    await prisma.invitation.create({
      data: {
        tenantId: fixtures.tenantA.tenantId,
        workspaceId: fixtures.tenantA.workspaceId,
        invitedByUserId: fixtures.tenantA.users[Role.OWNER].id,
        email,
        role: Role.AGENT,
        token,
        expiresAt: new Date(Date.now() + 86_400_000)
      }
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/invitations/accept/${token}`)
      .send({ displayName: "Limit Agent", password: "ChangeMe123!" })
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("PLAN_LIMIT_EXCEEDED");
    await expectUserMissing(email);
    await expectTenantMemberCount(fixtures.tenantB.tenantId, tenantBMembersBefore);
    await expectPlanLimitAudit(fixtures.tenantA.tenantId, "WorkspaceMember");
    await expectNoPlanLimitAudit(fixtures.tenantB.tenantId, "WorkspaceMember");
  });

  it("writes Tenant A plan-change audit without leaking to Tenant B audit list", async () => {
    const response = await authedPatch("/api/v1/tenants/me/plan", {
      planId: "pro"
    }).expect(200);

    expect(response.body.data.tenant.id).toBe(fixtures.tenantA.tenantId);
    const tenantAPlanAudit = await prisma.auditLog.findFirst({
      where: {
        tenantId: fixtures.tenantA.tenantId,
        action: AuditAction.PLAN_CHANGED,
        targetId: fixtures.tenantA.tenantId
      }
    });
    expect(tenantAPlanAudit).not.toBeNull();

    const tenantBResponse = await request(app.getHttpServer())
      .get("/api/v1/audit-logs")
      .set("Authorization", `Bearer ${fixtures.tenantB.users[Role.OWNER].accessToken}`)
      .expect(200);
    expect(JSON.stringify(tenantBResponse.body.data)).not.toContain(
      fixtures.tenantA.tenantId
    );
  });

  function authedGet(path: string): request.Test {
    return request(app.getHttpServer()).get(path).set("Authorization", bearer());
  }

  function authedPatch(path: string, body: Record<string, unknown>): request.Test {
    return request(app.getHttpServer())
      .patch(path)
      .set("Authorization", bearer())
      .send(body);
  }

  function authedPost(path: string, body: Record<string, unknown>): request.Test {
    return request(app.getHttpServer())
      .post(path)
      .set("Authorization", bearer())
      .send(body);
  }

  function authedDelete(path: string): request.Test {
    return request(app.getHttpServer()).delete(path).set("Authorization", bearer());
  }

  function bearer(): string {
    return `Bearer ${fixtures.tenantA.users[Role.OWNER].accessToken}`;
  }

  async function createInboxFixture(
    slug: string,
    fixture: Stage1Fixtures["tenantA"]
  ): Promise<{ conversationId: string }> {
    const channel = await prisma.lineChannel.create({
      data: {
        tenantId: fixture.tenantId,
        workspaceId: fixture.workspaceId,
        name: `${slug} LINE`,
        lineChannelId: `${slug}-line-channel`,
        encryptedChannelSecret: `${slug}-secret`,
        encryptedChannelAccessToken: `${slug}-access-token`
      }
    });
    const conversation = await prisma.conversation.create({
      data: {
        tenantId: fixture.tenantId,
        workspaceId: fixture.workspaceId,
        lineChannelId: channel.id,
        externalThreadId: `${slug}-thread`,
        displayName: `${slug} customer`,
        lastMessageAt: new Date()
      }
    });
    await prisma.message.create({
      data: {
        tenantId: fixture.tenantId,
        conversationId: conversation.id,
        lineChannelId: channel.id,
        direction: MessageDirection.INBOUND,
        type: MessageType.TEXT,
        externalMessageId: `${slug}-message`,
        text: slug === "tenant-a" ? "Tenant A inbox message" : "Tenant B inbox message",
        sentAt: new Date()
      }
    });

    return { conversationId: conversation.id };
  }

  async function expectTenantWorkspaceCount(
    tenantId: string,
    expectedCount: number
  ): Promise<void> {
    const actualCount = await prisma.workspace.count({
      where: { tenantId, deletedAt: null }
    });
    expect(actualCount).toBe(expectedCount);
  }

  async function expectTenantMemberCount(
    tenantId: string,
    expectedCount: number
  ): Promise<void> {
    const actualCount = await prisma.workspaceMember.count({
      where: { tenantId, isActive: true }
    });
    expect(actualCount).toBe(expectedCount);
  }

  async function expectUserMissing(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeNull();
  }

  async function expectPlanLimitAudit(
    tenantId: string,
    targetType: string
  ): Promise<void> {
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        action: AuditAction.PLAN_LIMIT_EXCEEDED,
        targetType
      }
    });
    expect(auditLog).not.toBeNull();
  }

  async function expectNoPlanLimitAudit(
    tenantId: string,
    targetType: string
  ): Promise<void> {
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        action: AuditAction.PLAN_LIMIT_EXCEEDED,
        targetType
      }
    });
    expect(auditLog).toBeNull();
  }
});
