import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TenantsService } from "./tenants.service";

type MockPrisma = {
  tenant: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
  planLimit: {
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
  };
  workspace: {
    count: jest.Mock<Promise<number>, [unknown]>;
  };
  workspaceMember: {
    count: jest.Mock<Promise<number>, [unknown]>;
  };
  auditLog: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
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
  planLimit: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>()
  },
  workspace: {
    count: jest.fn<Promise<number>, [unknown]>()
  },
  workspaceMember: {
    count: jest.fn<Promise<number>, [unknown]>()
  },
  auditLog: {
    create: jest.fn<Promise<unknown>, [unknown]>()
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

  it("returns plan limits and usage snapshot", async () => {
    const prisma = createPrisma();
    prisma.tenant.findFirst.mockResolvedValue({
      id: "tenant-1",
      planId: "free",
      trialEndsAt: null
    });
    prisma.planLimit.findUnique.mockResolvedValue({
      planId: "free",
      maxWorkspaces: 1,
      maxAgents: 2
    });
    prisma.workspace.count.mockResolvedValue(1);
    prisma.workspaceMember.count.mockResolvedValue(1);

    await expect(createService(prisma).getPlan("tenant-1")).resolves.toMatchObject({
      tenant: {
        id: "tenant-1",
        planId: "free"
      },
      limits: {
        planId: "free"
      },
      usage: {
        workspaces: 1,
        agents: 1
      }
    });
  });

  it("updates plan and writes audit log", async () => {
    const prisma = createPrisma();
    prisma.tenant.findFirst.mockResolvedValue({
      id: "tenant-1",
      planId: "free",
      trialEndsAt: null
    });
    prisma.planLimit.findUnique.mockResolvedValue({
      planId: "pro",
      maxWorkspaces: 3,
      maxAgents: 20
    });
    prisma.tenant.update.mockResolvedValue({ id: "tenant-1", planId: "pro" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    prisma.workspace.count.mockResolvedValue(1);
    prisma.workspaceMember.count.mockResolvedValue(1);

    await createService(prisma).updatePlan("tenant-1", "owner-1", {
      planId: "pro"
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "owner-1",
        action: "PLAN_CHANGED",
        targetType: "Tenant",
        targetId: "tenant-1"
      })
    });
  });
});
