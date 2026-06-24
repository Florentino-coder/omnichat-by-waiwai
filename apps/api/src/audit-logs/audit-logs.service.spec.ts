import { AuditAction } from "@prisma/client";
import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogsService } from "./audit-logs.service";

type MockPrisma = {
  auditLog: {
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
    count: jest.Mock<Promise<number>, [unknown]>;
  };
};

const sampleRow = {
  id: "log-1",
  action: AuditAction.AI_AUTO_REPLY_SENT,
  targetType: "Conversation",
  targetId: "conv-1",
  metadata: { reason: "test" },
  ipAddress: null,
  createdAt: new Date("2026-06-24T10:00:00.000Z"),
  user: {
    id: "user-1",
    displayName: "Admin",
    email: "admin@test.com"
  }
};

const createPrisma = (): MockPrisma => ({
  auditLog: {
    findMany: jest.fn<Promise<unknown>, [unknown]>(),
    count: jest.fn<Promise<number>, [unknown]>()
  }
});

const createService = (prisma: MockPrisma): AuditLogsService =>
  new AuditLogsService(prisma as unknown as PrismaService);

describe("AuditLogsService", () => {
  it("lists paginated audit logs scoped to tenant with actor", async () => {
    const prisma = createPrisma();
    prisma.auditLog.findMany.mockResolvedValue([sampleRow]);
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await createService(prisma).listPaginated("tenant-1", {
      page: 2,
      limit: 25
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1" },
        orderBy: { createdAt: "desc" },
        skip: 25,
        take: 25
      })
    );
    expect(result.items[0]?.actor?.email).toBe("admin@test.com");
    expect(result.total).toBe(1);
  });

  it("filters by category and date range", async () => {
    const prisma = createPrisma();
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.count.mockResolvedValue(0);

    await createService(prisma).listPaginated("tenant-1", {
      category: "ai",
      from: "2026-06-01",
      to: "2026-06-24"
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          action: { in: expect.arrayContaining([AuditAction.AI_AUTO_REPLY_SENT]) },
          createdAt: {
            gte: new Date("2026-06-01T00:00:00.000Z"),
            lte: new Date("2026-06-24T23:59:59.999Z")
          }
        })
      })
    );
  });

  it("exports csv with header and escaped values", async () => {
    const prisma = createPrisma();
    prisma.auditLog.findMany.mockResolvedValue([
      {
        ...sampleRow,
        metadata: { note: 'comma, quote"' }
      }
    ]);

    const csv = await createService(prisma).exportCsv("tenant-1", { category: "ai" });

    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("createdAt,action,actorEmail");
    expect(csv).toContain("AI_AUTO_REPLY_SENT");
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10000,
        where: expect.objectContaining({ tenantId: "tenant-1" })
      })
    );
  });

  it("rejects invalid from date", async () => {
    const prisma = createPrisma();
    await expect(
      createService(prisma).listPaginated("tenant-1", { from: "not-a-date" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
