import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AuditAction, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { KnowledgeDocumentService } from "./knowledge-document.service";
import { KnowledgeService } from "./knowledge.service";

function createPrismaMock() {
  return {
    knowledgeArticle: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    lineChannel: {
      findFirst: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    }
  };
}

function createDocumentServiceMock() {
  return {
    buildHybridKnowledgeContext: jest.fn()
  };
}

describe("KnowledgeService", () => {
  it("creates article with audit log", async () => {
    const prisma = createPrismaMock();
    const knowledgeDocumentService = createDocumentServiceMock();
    prisma.knowledgeArticle.create.mockResolvedValue({
      id: "article-1",
      tenantId: "tenant-1",
      title: "FAQ",
      lineChannelId: null
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const service = new KnowledgeService(
      prisma as unknown as PrismaService,
      knowledgeDocumentService as unknown as KnowledgeDocumentService
    );
    const article = await service.createArticle("tenant-1", "user-1", {
      title: "FAQ",
      content: "Answer here",
      keywords: ["faq"]
    });

    expect(article.id).toBe("article-1");
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AuditAction.KNOWLEDGE_ARTICLE_CREATED,
        targetType: "KnowledgeArticle",
        targetId: "article-1"
      })
    });
  });

  it("blocks delete for agents", async () => {
    const prisma = createPrismaMock();
    const knowledgeDocumentService = createDocumentServiceMock();
    prisma.knowledgeArticle.findFirst.mockResolvedValue({
      id: "article-1",
      tenantId: "tenant-1",
      title: "FAQ"
    });

    const service = new KnowledgeService(
      prisma as unknown as PrismaService,
      knowledgeDocumentService as unknown as KnowledgeDocumentService
    );

    await expect(
      service.deleteArticle("tenant-1", "user-1", Role.AGENT, "article-1")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("builds knowledge context from ranked articles", async () => {
    const prisma = createPrismaMock();
    const knowledgeDocumentService = createDocumentServiceMock();
    knowledgeDocumentService.buildHybridKnowledgeContext.mockResolvedValue({
      context: "1. [Policy] Shipping\nFree shipping over 1000 THB",
      citations: [{ type: "article", title: "Shipping", excerpt: "Free shipping" }]
    });

    const service = new KnowledgeService(
      prisma as unknown as PrismaService,
      knowledgeDocumentService as unknown as KnowledgeDocumentService
    );
    const context = await service.buildKnowledgeContext(
      "tenant-1",
      "delivery free shipping"
    );

    expect(context).toContain("[Policy] Shipping");
    expect(context).toContain("Free shipping over 1000 THB");
    expect(knowledgeDocumentService.buildHybridKnowledgeContext).toHaveBeenCalledWith(
      "tenant-1",
      "delivery free shipping",
      undefined,
      5
    );
  });

  it("throws when article not found in tenant", async () => {
    const prisma = createPrismaMock();
    const knowledgeDocumentService = createDocumentServiceMock();
    prisma.knowledgeArticle.findFirst.mockResolvedValue(null);

    const service = new KnowledgeService(
      prisma as unknown as PrismaService,
      knowledgeDocumentService as unknown as KnowledgeDocumentService
    );

    await expect(service.findOne("tenant-1", "missing")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
