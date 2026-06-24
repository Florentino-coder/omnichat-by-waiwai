import { QaService } from "./qa.service";

describe("QaService", () => {
  const prisma = {
    aiQaScore: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn()
    },
    message: {
      findFirst: jest.fn()
    },
    auditLog: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    tenantSettings: {
      findUnique: jest.fn()
    }
  };

  let service: QaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QaService(prisma as any);
  });

  it("lists scores sorted by lowest overall first", async () => {
    prisma.aiQaScore.findMany.mockResolvedValue([
      {
        id: "high",
        conversationId: "c1",
        messageId: "m1",
        relevanceScore: 5,
        toneScore: 5,
        hallucinationScore: 5,
        reviewNote: null,
        reviewedAt: null,
        createdAt: new Date("2026-06-20"),
        conversation: { id: "c1", displayName: "A", nickname: null }
      },
      {
        id: "low",
        conversationId: "c2",
        messageId: "m2",
        relevanceScore: 1,
        toneScore: 2,
        hallucinationScore: 2,
        reviewNote: null,
        reviewedAt: null,
        createdAt: new Date("2026-06-21"),
        conversation: { id: "c2", displayName: "B", nickname: null }
      }
    ]);

    const result = await service.listScores("tenant-1", { page: 1, limit: 10 });

    expect(result.items[0].id).toBe("low");
    expect(result.items[0].overallScore).toBeCloseTo(1.67, 1);
  });

  it("aggregates compliance summary counts", async () => {
    prisma.auditLog.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1);
    prisma.aiQaScore.findMany.mockResolvedValue([
      { relevanceScore: 2, toneScore: 2, hallucinationScore: 2 },
      { relevanceScore: 4, toneScore: 4, hallucinationScore: 4 }
    ]);
    prisma.aiQaScore.count.mockResolvedValue(2);
    prisma.tenantSettings.findUnique.mockResolvedValue({
      enableAiAutoReply: false,
      aiGuardrailNoticeAt: new Date("2026-06-24")
    });

    const summary = await service.getComplianceSummary("tenant-1", {});

    expect(summary.policyBlocks).toBe(2);
    expect(summary.escalations).toBe(5);
    expect(summary.guardrailEvents).toBe(1);
    expect(summary.lowQaScores).toBe(1);
    expect(summary.aiAutoReplyEnabled).toBe(false);
  });
});
