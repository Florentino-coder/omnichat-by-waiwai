import { INestApplication } from "@nestjs/common";
import {
  AuditAction,
  PrismaClient,
  Role
} from "@prisma/client";
import request from "supertest";
import { ApiTestAppContext, createApiTestAppWithMocks } from "./helpers/api-test-app";
import {
  createInboxAiFixture,
  mockLinePushSuccess
} from "./helpers/inbox-ai-fixtures";
import {
  AI_SUGGEST_USAGE_METRIC,
  getCurrentMonthUsagePeriod
} from "../src/inbox/thai-speech.util";
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

describe("AI launch verification e2e", () => {
  jest.setTimeout(180000);

  let app: INestApplication;
  let prisma: PrismaClient;
  let fixtures: Stage1Fixtures;
  let testContext: ApiTestAppContext;
  let fetchMock: jest.Mock;

  beforeAll(async () => {
    testContext = await createApiTestAppWithMocks();
    app = testContext.app;
    prisma = new PrismaClient();
    fixtures = await createStage1Fixtures(prisma);
  });

  beforeEach(() => {
    testContext.redisClient.reset();
    testContext.llmClient.generateReply = jest
      .fn()
      .mockResolvedValue("สวัสดีค่ะ ยินดีให้บริการนะคะ");
    fetchMock = mockLinePushSuccess();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(async () => {
    global.fetch = fetch;
    await prisma?.$disconnect();
    await app?.close();
  });

  it("syncs conversation list and message thread after agent reply", async () => {
    const inbox = await createInboxAiFixture(prisma, fixtures.tenantA, "sync-a");
    const replyText = "ตอบกลับจาก agent sync test";

    const beforeMessages = await agentGet(
      `/api/v1/inbox/conversations/${inbox.conversationId}/messages`
    ).expect(200);
    expect(JSON.stringify(beforeMessages.body.data)).toContain("sync-a customer question");
    expect(JSON.stringify(beforeMessages.body.data)).not.toContain(replyText);

    await agentPost(`/api/v1/line/conversations/${inbox.conversationId}/reply`, {
      text: replyText
    }).expect(201);

    const messages = await agentGet(
      `/api/v1/inbox/conversations/${inbox.conversationId}/messages`
    ).expect(200);
    expect(JSON.stringify(messages.body.data)).toContain(replyText);

    const conversations = await agentGet("/api/v1/inbox/conversations").expect(200);
    const row = (conversations.body.data as Array<{ id: string; messages?: Array<{ text?: string }> }>).find(
      (item) => item.id === inbox.conversationId
    );
    expect(row).toBeDefined();
    expect(JSON.stringify(row)).toContain(replyText);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("runs AI generate → edit → send status flow with audit logs", async () => {
    const inbox = await createInboxAiFixture(prisma, fixtures.tenantA, "ai-flow-a");
    testContext.llmClient.generateReply = jest
      .fn()
      .mockResolvedValue("สวัสดีค่ะ ขอบคุณที่ติดต่อนะคะ");

    const generated = await agentPost(
      `/api/v1/inbox/conversations/${inbox.conversationId}/ai-suggest`,
      { action_type: "generate" }
    ).expect(201);

    expect(generated.body.success).toBe(true);
    expect(generated.body.data.suggestion_id).toBeTruthy();
    expect(generated.body.data.suggestion_text).toContain("สวัสดี");

    const suggestionId = generated.body.data.suggestion_id as string;
    const editedText = "สวัสดีค่ะ ดิฉันขอช่วยเหลือค่ะ";

    await agentPatch(`/api/v1/inbox/ai-suggestions/${suggestionId}`, {
      status: "edited",
      final_sent_text: editedText
    }).expect(200);

    await agentPatch(`/api/v1/inbox/ai-suggestions/${suggestionId}`, {
      status: "sent",
      final_sent_text: editedText
    }).expect(200);

    const auditLogs = await ownerGet("/api/v1/audit-logs").expect(200);
    const serialized = JSON.stringify(auditLogs.body.data);
    expect(serialized).toContain(AuditAction.AI_SUGGEST_GENERATED);
    expect(serialized).toContain(AuditAction.AI_SUGGEST_EDITED);
    expect(serialized).toContain(AuditAction.AI_SUGGEST_SENT);
  });

  it("blocks AI suggest when conversation rate limit exceeded", async () => {
    const inbox = await createInboxAiFixture(prisma, fixtures.tenantA, "rate-a");

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await agentPost(`/api/v1/inbox/conversations/${inbox.conversationId}/ai-suggest`, {
        action_type: "generate"
      }).expect(201);
    }

    const blocked = await agentPost(
      `/api/v1/inbox/conversations/${inbox.conversationId}/ai-suggest`,
      { action_type: "generate" }
    ).expect(429);

    expect(blocked.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("blocks AI suggest when monthly credits are exhausted", async () => {
    const inbox = await createInboxAiFixture(prisma, fixtures.tenantA, "quota-a");
    const { periodStart, periodEnd } = getCurrentMonthUsagePeriod();

    await prisma.usageCounter.upsert({
      where: {
        tenantId_metric_periodStart: {
          tenantId: fixtures.tenantA.tenantId,
          metric: AI_SUGGEST_USAGE_METRIC,
          periodStart
        }
      },
      update: { value: 1000n },
      create: {
        tenantId: fixtures.tenantA.tenantId,
        metric: AI_SUGGEST_USAGE_METRIC,
        periodStart,
        periodEnd,
        value: 1000n
      }
    });

    const blocked = await agentPost(
      `/api/v1/inbox/conversations/${inbox.conversationId}/ai-suggest`,
      { action_type: "generate" }
    ).expect(403);

    expect(blocked.body.error.code).toBe("PLAN_LIMIT_EXCEEDED");

    const usage = await ownerGet("/api/v1/inbox/ai-usage").expect(200);
    expect(usage.body.data.creditsAvailable).toBe(false);
    expect(usage.body.data.blockReason).toBe("MONTHLY_LIMIT_REACHED");
  });

  it("reports PLAN_EXCLUDES_AI when plan has zero monthly credits", async () => {
    await prisma.tenant.update({
      where: { id: fixtures.tenantA.tenantId },
      data: { planId: "free" }
    });

    const usage = await ownerGet("/api/v1/inbox/ai-usage").expect(200);
    expect(usage.body.data.limit).toBe(0);
    expect(usage.body.data.blockReason).toBe("PLAN_EXCLUDES_AI");

    await prisma.tenant.update({
      where: { id: fixtures.tenantA.tenantId },
      data: { planId: "starter" }
    });
  });

  it("keeps AI endpoints tenant-isolated", async () => {
    const tenantAInbox = await createInboxAiFixture(prisma, fixtures.tenantA, "iso-a");
    const tenantBInbox = await createInboxAiFixture(prisma, fixtures.tenantB, "iso-b");

    const tenantAGenerated = await agentPost(
      `/api/v1/inbox/conversations/${tenantAInbox.conversationId}/ai-suggest`,
      { action_type: "generate" }
    ).expect(201);
    const tenantASuggestionId = tenantAGenerated.body.data.suggestion_id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/inbox/conversations/${tenantAInbox.conversationId}/ai-suggest`)
      .set("Authorization", bearer(fixtures.tenantB.users[Role.AGENT].accessToken))
      .send({ action_type: "generate" })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/inbox/ai-suggestions/${tenantASuggestionId}`)
      .set("Authorization", bearer(fixtures.tenantB.users[Role.AGENT].accessToken))
      .send({ status: "edited", final_sent_text: "cross tenant edit" })
      .expect(404);

    const tenantBUsage = await request(app.getHttpServer())
      .get("/api/v1/inbox/ai-usage")
      .set("Authorization", bearer(fixtures.tenantB.users[Role.OWNER].accessToken))
      .expect(200);
    expect(tenantBUsage.body.data.planId).toBe("starter");

    const tenantBConversations = await request(app.getHttpServer())
      .get("/api/v1/inbox/conversations")
      .set("Authorization", bearer(fixtures.tenantB.users[Role.AGENT].accessToken))
      .expect(200);
    expect(JSON.stringify(tenantBConversations.body.data)).toContain(tenantBInbox.conversationId);
    expect(JSON.stringify(tenantBConversations.body.data)).not.toContain(tenantAInbox.conversationId);
  });

  function bearer(token: string): string {
    return `Bearer ${token}`;
  }

  function agentGet(path: string): request.Test {
    return request(app.getHttpServer())
      .get(path)
      .set("Authorization", bearer(fixtures.tenantA.users[Role.AGENT].accessToken));
  }

  function agentPost(path: string, body: Record<string, unknown>): request.Test {
    return request(app.getHttpServer())
      .post(path)
      .set("Authorization", bearer(fixtures.tenantA.users[Role.AGENT].accessToken))
      .send(body);
  }

  function agentPatch(path: string, body: Record<string, unknown>): request.Test {
    return request(app.getHttpServer())
      .patch(path)
      .set("Authorization", bearer(fixtures.tenantA.users[Role.AGENT].accessToken))
      .send(body);
  }

  function ownerGet(path: string): request.Test {
    return request(app.getHttpServer())
      .get(path)
      .set("Authorization", bearer(fixtures.tenantA.users[Role.OWNER].accessToken));
  }
});
