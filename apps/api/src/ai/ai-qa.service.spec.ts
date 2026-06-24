import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { AiGuardrailService } from "./ai-guardrail.service";
import { AiQaScorerService } from "./ai-qa-scorer.service";
import { AiQaService } from "./ai-qa.service";

describe("AiQaService", () => {
  let service: AiQaService;

  const prisma = {
    auditLog: { findMany: jest.fn() },
    message: { findFirst: jest.fn(), findMany: jest.fn() },
    aiQaScore: { create: jest.fn(), findMany: jest.fn() }
  };

  const qaScorer = {
    scoreReply: jest.fn()
  };

  const guardrailService = {
    evaluateTenantsAfterSampling: jest.fn().mockResolvedValue(0)
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiQaService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiQaScorerService, useValue: qaScorer },
        { provide: AiGuardrailService, useValue: guardrailService }
      ]
    }).compile();

    service = module.get(AiQaService);
  });

  it("stores sampled QA scores from previous day audit logs", async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      { id: "log-1", tenantId: "tenant-1", targetId: "conv-1", metadata: {} }
    ]);
    prisma.message.findFirst
      .mockResolvedValueOnce({
        id: "msg-out",
        text: "AI reply",
        createdAt: new Date("2026-06-24T10:00:00.000Z")
      })
      .mockResolvedValueOnce({
        text: "Customer question"
      });
    prisma.message.findMany.mockResolvedValue([
      { direction: "INBOUND", text: "Customer question" }
    ]);
    qaScorer.scoreReply.mockResolvedValue({
      relevanceScore: 4,
      toneScore: 5,
      hallucinationScore: 4
    });
    prisma.aiQaScore.create.mockResolvedValue({});

    await service.runDailySampling();

    expect(prisma.aiQaScore.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        conversationId: "conv-1",
        messageId: "msg-out",
        relevanceScore: 4,
        toneScore: 5,
        hallucinationScore: 4
      })
    });
  });

  it("returns tenant QA summary averages", async () => {
    prisma.aiQaScore.findMany.mockResolvedValue([
      { relevanceScore: 4, toneScore: 5, hallucinationScore: 3 },
      { relevanceScore: 5, toneScore: 4, hallucinationScore: 4 }
    ]);

    const summary = await service.getTenantQaSummary(
      "tenant-1",
      "2026-06-01",
      "2026-06-30"
    );

    expect(summary.sampleCount).toBe(2);
    expect(summary.avgRelevance).toBe(4.5);
    expect(summary.avgTone).toBe(4.5);
    expect(summary.avgHallucination).toBe(3.5);
  });
});
