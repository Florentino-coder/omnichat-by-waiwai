import { PrismaService } from "../prisma/prisma.service";
import { AuditLogsService } from "./audit-logs.service";

type MockPrisma = {
  auditLog: {
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

const createPrisma = (): MockPrisma => ({
  auditLog: {
    findMany: jest.fn<Promise<unknown>, [unknown]>()
  }
});

const createService = (prisma: MockPrisma): AuditLogsService =>
  new AuditLogsService(prisma as unknown as PrismaService);

describe("AuditLogsService", () => {
  it("lists latest audit logs only for current tenant", async () => {
    const prisma = createPrisma();
    prisma.auditLog.findMany.mockResolvedValue([]);

    await createService(prisma).list("tenant-1");

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  });
});
