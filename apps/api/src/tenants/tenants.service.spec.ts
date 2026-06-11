import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TenantsService } from "./tenants.service";

type MockPrisma = {
  tenant: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
  tenantSettings: {
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

const createPrisma = (): MockPrisma => ({
  tenant: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>()
  },
  tenantSettings: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>()
  }
});

const createService = (prisma: MockPrisma): TenantsService =>
  new TenantsService(prisma as unknown as PrismaService);

describe("TenantsService", () => {
  it("loads the current tenant by tenantId and excludes soft-deleted tenants", async () => {
    const prisma = createPrisma();
    prisma.tenant.findFirst.mockResolvedValue({ id: "tenant-1" });

    await createService(prisma).getTenant("tenant-1");

    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: {
        id: "tenant-1",
        deletedAt: null
      }
    });
  });

  it("throws when the tenant is missing", async () => {
    const prisma = createPrisma();
    prisma.tenant.findFirst.mockResolvedValue(null);

    await expect(createService(prisma).getTenant("tenant-1")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("updates settings by tenantId only after tenant existence is verified", async () => {
    const prisma = createPrisma();
    prisma.tenant.findFirst.mockResolvedValue({ id: "tenant-1" });
    prisma.tenantSettings.update.mockResolvedValue({ tenantId: "tenant-1" });

    await createService(prisma).updateSettings("tenant-1", {
      timezone: "Asia/Bangkok"
    });

    expect(prisma.tenantSettings.update).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
      data: { timezone: "Asia/Bangkok" }
    });
  });
});
