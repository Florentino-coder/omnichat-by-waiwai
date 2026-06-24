import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction, MessageDirection } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AiQaService } from "../ai/ai-qa.service";
import { ReportingService } from "./reporting.service";

describe("ReportingService", () => {
  let service: ReportingService;
  let prisma: any;

  const mockPrisma = {
    conversation: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    message: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    conversationTagLink: {
      findMany: jest.fn(),
    },
    conversationTag: {
      findMany: jest.fn(),
    },
    workspaceMember: {
      findMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
    usageCounter: {
      findMany: jest.fn(),
    },
  };

  const aiQaService = {
    getTenantQaSummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: AiQaService,
          useValue: aiQaService,
        },
      ],
    }).compile();

    service = module.get<ReportingService>(ReportingService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe("parseDateRange", () => {
    it("should parse valid ISO-8601 strings", () => {
      const result = (service as any).parseDateRange("2026-06-01", "2026-06-15");
      expect(result.fromDate).toBeInstanceOf(Date);
      expect(result.toDate).toBeInstanceOf(Date);
      expect(result.fromDate.toISOString().startsWith("2026-06-01")).toBe(true);
      expect(result.toDate.toISOString().startsWith("2026-06-15")).toBe(true);
    });

    it("should throw BadRequestException for invalid dates", () => {
      expect(() => {
        (service as any).parseDateRange("not-a-date", "2026-06-15");
      }).toThrow(BadRequestException);
    });

    it("should throw BadRequestException if start date is after end date", () => {
      expect(() => {
        (service as any).parseDateRange("2026-06-20", "2026-06-15");
      }).toThrow(BadRequestException);
    });

    it("should throw BadRequestException if range is wider than 90 days", () => {
      expect(() => {
        (service as any).parseDateRange("2026-01-01", "2026-06-01");
      }).toThrow(BadRequestException);
    });
  });

  describe("getSummary", () => {
    it("should count tenant conversations and messages in date range", async () => {
      const tenantId = "test-tenant-id";
      prisma.conversation.count.mockResolvedValue(10);
      prisma.message.count.mockResolvedValue(50);

      const summary = await service.getSummary(tenantId, "2026-06-01", "2026-06-15");

      expect(summary.totalConversations).toBe(10);
      expect(summary.totalMessages).toBe(50);
      expect(prisma.conversation.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            deletedAt: null,
          }),
        }),
      );
    });
  });

  describe("getCharts", () => {
    it("should return formatted message volume, tag share, and agent workload arrays", async () => {
      const tenantId = "test-tenant-id";

      prisma.message.findMany.mockResolvedValue([
        { createdAt: new Date("2026-06-01T10:00:00Z"), direction: MessageDirection.INBOUND },
        { createdAt: new Date("2026-06-01T15:00:00Z"), direction: MessageDirection.OUTBOUND },
        { createdAt: new Date("2026-06-02T11:00:00Z"), direction: MessageDirection.INBOUND },
      ]);

      prisma.conversationTagLink.findMany.mockResolvedValue([
        { tagId: "tag-1" },
        { tagId: "tag-1" },
      ]);

      prisma.conversationTag.findMany.mockResolvedValue([
        { id: "tag-1", name: "Inquiry", color: "#ff0000" },
      ]);

      prisma.conversation.findMany.mockResolvedValue([
        { assignedToMemberId: "agent-1" },
        { assignedToMemberId: null },
      ]);

      prisma.workspaceMember.findMany.mockResolvedValue([
        { id: "agent-1", user: { displayName: "John Doe" } },
      ]);

      const charts = await service.getCharts(tenantId, "2026-06-01", "2026-06-02");

      // Daily Message Volume check
      expect(charts.dailyMessageVolume).toHaveLength(2);
      expect(charts.dailyMessageVolume[0]).toEqual({
        date: "2026-06-01",
        inbound: 1,
        outbound: 1,
      });

      // Tag Distribution check
      expect(charts.tagDistribution).toHaveLength(1);
      expect(charts.tagDistribution[0]).toEqual({
        name: "Inquiry",
        color: "#ff0000",
        count: 2,
      });

      // Workload check
      expect(charts.agentWorkload).toHaveLength(2);
      expect(charts.agentWorkload).toContainEqual({
        agentName: "John Doe",
        count: 1,
      });
      expect(charts.agentWorkload).toContainEqual({
        agentName: "ยังไม่มีผู้รับผิดชอบ",
        count: 1,
      });
    });
  });

  describe("getAiSummary", () => {
    it("aggregates AI audit actions and credits in date range", async () => {
      const tenantId = "test-tenant-id";
      prisma.auditLog.findMany.mockResolvedValue([
        { action: AuditAction.AI_AUTO_REPLY_SENT, metadata: {} },
        { action: AuditAction.AI_AUTO_REPLY_ESCALATED, metadata: {} },
        { action: AuditAction.AUTOMATION_AI_REPLY_SENT, metadata: {} },
        { action: AuditAction.AI_AUTO_REPLY_SKIPPED, metadata: { reason: "debounce" } },
        { action: AuditAction.AI_AUTO_REPLY_SKIPPED, metadata: { reason: "debounce" } }
      ]);
      prisma.usageCounter.findMany.mockResolvedValue([{ value: 12n }]);

      const summary = await service.getAiSummary(tenantId, "2026-06-01", "2026-06-15");

      expect(summary.autoReplySent).toBe(1);
      expect(summary.autoReplyEscalated).toBe(1);
      expect(summary.automationAiReplySent).toBe(1);
      expect(summary.skippedByReason).toEqual({ debounce: 2 });
      expect(summary.aiCreditsUsed).toBe(12);
    });
  });
});
