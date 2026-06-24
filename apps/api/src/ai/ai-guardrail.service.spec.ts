import { AiGuardrailService } from "./ai-guardrail.service";

describe("AiGuardrailService", () => {
  const prisma = {
    aiQaScore: {
      findMany: jest.fn()
    },
    tenantSettings: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    }
  };

  let service: AiGuardrailService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiGuardrailService(prisma as any);
  });

  it("returns false when fewer than 3 days of rolling averages exist", async () => {
    prisma.aiQaScore.findMany.mockResolvedValue([]);

    const result = await service.shouldDisableAutoReply("tenant-1", new Date("2026-06-25T12:00:00Z"));

    expect(result).toBe(false);
  });

  it("returns true when 3 consecutive rolling averages are below threshold", async () => {
    prisma.aiQaScore.findMany
      .mockResolvedValueOnce([
        { relevanceScore: 2, toneScore: 2, hallucinationScore: 2 },
        { relevanceScore: 2, toneScore: 2, hallucinationScore: 2 }
      ])
      .mockResolvedValueOnce([{ relevanceScore: 2, toneScore: 2, hallucinationScore: 2 }])
      .mockResolvedValueOnce([{ relevanceScore: 2, toneScore: 2, hallucinationScore: 2 }]);

    const result = await service.shouldDisableAutoReply("tenant-1", new Date("2026-06-25T12:00:00Z"));

    expect(result).toBe(true);
  });

  it("returns false when one day rolling average is above threshold", async () => {
    prisma.aiQaScore.findMany
      .mockResolvedValueOnce([{ relevanceScore: 4, toneScore: 4, hallucinationScore: 4 }])
      .mockResolvedValueOnce([{ relevanceScore: 2, toneScore: 2, hallucinationScore: 2 }])
      .mockResolvedValueOnce([{ relevanceScore: 2, toneScore: 2, hallucinationScore: 2 }]);

    const result = await service.shouldDisableAutoReply("tenant-1", new Date("2026-06-25T12:00:00Z"));

    expect(result).toBe(false);
  });

  it("disables auto-reply and writes audit when guardrail triggers", async () => {
    prisma.aiQaScore.findMany
      .mockResolvedValueOnce([{ tenantId: "tenant-1" }])
      .mockResolvedValueOnce([
        { relevanceScore: 2, toneScore: 2, hallucinationScore: 2 }
      ])
      .mockResolvedValueOnce([
        { relevanceScore: 2, toneScore: 2, hallucinationScore: 2 }
      ])
      .mockResolvedValueOnce([
        { relevanceScore: 2, toneScore: 2, hallucinationScore: 2 }
      ]);

    prisma.tenantSettings.findUnique.mockResolvedValue({ enableAiAutoReply: true });
    prisma.tenantSettings.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});

    const disabled = await service.evaluateTenantsAfterSampling(new Date("2026-06-25T12:00:00Z"));

    expect(disabled).toBe(1);
    expect(prisma.tenantSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1" },
        data: expect.objectContaining({ enableAiAutoReply: false })
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "AI_AUTO_REPLY_DISABLED_BY_GUARDRAIL"
        })
      })
    );
  });
});
