import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { AiCurationService } from "./ai-curation.service";

describe("AiCurationService", () => {
  let service: AiCurationService;
  let prisma: any;

  const mockPrisma = {
    aiTrainingPair: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    knowledgeArticle: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiCurationService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<AiCurationService>(AiCurationService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe("listPairs", () => {
    it("should count and find training pairs", async () => {
      const tenantId = "tenant-1";
      prisma.aiTrainingPair.count.mockResolvedValue(5);
      prisma.aiTrainingPair.findMany.mockResolvedValue([
        { id: "pair-1", customerMessage: "hello" },
      ]);

      const result = await service.listPairs(tenantId, { limit: 10, offset: 0 });

      expect(result.total).toBe(5);
      expect(result.items).toHaveLength(1);
      expect(prisma.aiTrainingPair.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            deletedAt: null,
          }),
        }),
      );
    });
  });

  describe("updatePair", () => {
    it("should throw NotFoundException if pair does not exist", async () => {
      prisma.aiTrainingPair.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePair("tenant-1", "pair-1", { customerMessage: "new text" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should update pair and flag as edited if text is changed", async () => {
      const existing = {
        id: "pair-1",
        customerMessage: "old q",
        assistantReply: "old a",
        isEdited: false,
      };
      prisma.aiTrainingPair.findFirst.mockResolvedValue(existing);
      prisma.aiTrainingPair.update.mockResolvedValue({ ...existing, isEdited: true });

      await service.updatePair("tenant-1", "pair-1", {
        customerMessage: "new q",
      });

      expect(prisma.aiTrainingPair.update).toHaveBeenCalledWith({
        where: { id: "pair-1" },
        data: expect.objectContaining({
          customerMessage: "new q",
          isEdited: true,
        }),
      });
    });

    it("should throw BadRequestException if trying to update status to approved", async () => {
      prisma.aiTrainingPair.findFirst.mockResolvedValue({
        id: "pair-1",
        status: "pending",
      });

      await expect(
        service.updatePair("tenant-1", "pair-1", { status: "approved" as any }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("approvePair", () => {
    it("should throw ConflictException if already approved", async () => {
      prisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(prisma);
      });

      prisma.aiTrainingPair.findFirst.mockResolvedValue({
        id: "pair-1",
        status: "approved",
        conversation: { lineChannelId: "channel-1" },
      });

      await expect(
        service.approvePair("tenant-1", "user-1", "pair-1", { global: false }),
      ).rejects.toThrow(ConflictException);
    });

    it("should successfully approve and create a KnowledgeArticle", async () => {
      prisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(prisma);
      });

      const mockPair = {
        id: "pair-1",
        status: "pending",
        customerMessage: "hi",
        assistantReply: "hello there",
        conversation: { lineChannelId: "channel-1" },
      };

      prisma.aiTrainingPair.findFirst.mockResolvedValue(mockPair);
      prisma.aiTrainingPair.update.mockResolvedValue({ ...mockPair, status: "approved" });
      prisma.knowledgeArticle.create.mockResolvedValue({ id: "article-1" });
      prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

      const article = await service.approvePair("tenant-1", "user-1", "pair-1", { global: false });

      expect(article).toBeDefined();
      expect(prisma.aiTrainingPair.update).toHaveBeenCalledWith({
        where: { id: "pair-1" },
        data: { status: "approved" },
      });
      expect(prisma.knowledgeArticle.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          lineChannelId: "channel-1", // inherited
          title: "hi",
          content: "hello there",
        }),
      });
    });
  });
});
