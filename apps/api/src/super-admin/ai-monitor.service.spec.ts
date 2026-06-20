import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { AiMonitorService } from "./ai-monitor.service";
import { PrismaService } from "../prisma/prisma.service";

function createPrismaMock() {
  return {
    aiSuggestion: {
      findMany: jest.fn()
    },
    auditLog: {
      findMany: jest.fn()
    },
    usageCounter: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    tenant: {
      findMany: jest.fn(),
      findFirst: jest.fn()
    },
    planLimit: {
      findMany: jest.fn(),
      findUnique: jest.fn()
    },
    tenantSettings: {
      findUnique: jest.fn()
    }
  };
}

describe("AiMonitorService", () => {
  let service: AiMonitorService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiMonitorService,
        {
          provide: PrismaService,
          useValue: prisma
        }
      ]
    }).compile();

    service = module.get(AiMonitorService);
  });

  it("should aggregate platform stats for last 24h", async () => {
    prisma.aiSuggestion.findMany.mockResolvedValue([
      { id: "s1", tenantId: "tenant-1", provider: "gemini", latencyMs: 1200 },
      { id: "s2", tenantId: "tenant-1", provider: "gemini", latencyMs: 1800 }
    ]);
    prisma.auditLog.findMany
      .mockResolvedValueOnce([
        { metadata: { mode: "test", latencyMs: 900 } },
        { metadata: { mode: "suggest", latencyMs: 1100 } }
      ])
      .mockResolvedValueOnce([{ metadata: { errorCode: "AI_PROVIDER_TIMEOUT" } }]);
    prisma.usageCounter.findMany.mockResolvedValue([
      { tenantId: "tenant-1", value: 25n }
    ]);
    prisma.tenant.findMany.mockResolvedValue([
      { id: "tenant-1", name: "Acme", planId: "pro" }
    ]);
    prisma.planLimit.findMany.mockResolvedValue([
      { planId: "pro", maxAiCreditsPerMonth: 500 }
    ]);

    const stats = await service.getStats();

    expect(stats.totalCalls24h).toBe(4);
    expect(stats.successCount24h).toBe(3);
    expect(stats.failureCount24h).toBe(1);
    expect(stats.avgLatencyMs).toBeGreaterThan(0);
    expect(stats.byProvider[0]?.provider).toBe("gemini");
    expect(stats.topTenants[0]?.tenantName).toBe("Acme");
    expect(stats.errorDistribution[0]?.code).toBe("AI_PROVIDER_TIMEOUT");
  });

  it("should return slowest AI calls ordered by latency", async () => {
    prisma.aiSuggestion.findMany.mockResolvedValue([
      {
        id: "slow-1",
        tenantId: "tenant-1",
        conversationId: "conv-1",
        provider: "gemini",
        latencyMs: 8200,
        actionType: "generate",
        createdAt: new Date("2026-06-21T10:00:00.000Z"),
        tenant: { name: "Acme" }
      }
    ]);

    const slowest = await service.getSlowest(5);

    expect(slowest).toHaveLength(1);
    expect(slowest[0]?.latencyMs).toBe(8200);
    expect(slowest[0]?.tenantName).toBe("Acme");
  });

  it("should expose provider health without leaking API keys", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    prisma.aiSuggestion.findMany.mockResolvedValue([
      {
        provider: "gemini",
        createdAt: new Date("2026-06-21T09:00:00.000Z"),
        latencyMs: 1500
      }
    ]);
    prisma.auditLog.findMany.mockResolvedValue([]);

    const health = await service.getHealth();

    expect(health.providers.some((provider) => provider.id === "gemini")).toBe(true);
    expect(health.providers.find((provider) => provider.id === "gemini")?.configured).toBe(true);
    expect(JSON.stringify(health)).not.toContain("test-key");

    delete process.env.GEMINI_API_KEY;
  });

  it("should return tenant usage snapshot", async () => {
    prisma.tenant.findFirst.mockResolvedValue({
      id: "tenant-1",
      name: "Acme",
      planId: "pro"
    });
    prisma.tenantSettings.findUnique.mockResolvedValue({ aiProvider: "gemini" });
    prisma.planLimit.findUnique.mockResolvedValue({ maxAiCreditsPerMonth: 500 });
    prisma.usageCounter.findUnique.mockResolvedValue({ value: 120n });
    prisma.aiSuggestion.findMany
      .mockResolvedValueOnce([{ latencyMs: 1000 }, { latencyMs: 2000 }])
      .mockResolvedValueOnce([
        {
          id: "s1",
          conversationId: "conv-1",
          provider: "gemini",
          latencyMs: 1000,
          status: "sent",
          createdAt: new Date("2026-06-21T10:00:00.000Z")
        }
      ]);

    const usage = await service.getTenantUsage("tenant-1");

    expect(usage.tenantName).toBe("Acme");
    expect(usage.used).toBe(120);
    expect(usage.limit).toBe(500);
    expect(usage.calls24h).toBe(2);
    expect(usage.recentCalls).toHaveLength(1);
  });

  it("should throw when tenant usage target does not exist", async () => {
    prisma.tenant.findFirst.mockResolvedValue(null);

    await expect(service.getTenantUsage("missing-tenant")).rejects.toThrow(NotFoundException);
  });
});
