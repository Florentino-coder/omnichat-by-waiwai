import { NotFoundException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspacesService } from "./workspaces.service";

type MockPrisma = {
  workspace: {
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    create: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
  workspaceMember: {
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

const createPrisma = (): MockPrisma => ({
  workspace: {
    findMany: jest.fn<Promise<unknown>, [unknown]>(),
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    create: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>()
  },
  workspaceMember: {
    findMany: jest.fn<Promise<unknown>, [unknown]>(),
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>()
  }
});

const createService = (prisma: MockPrisma): WorkspacesService =>
  new WorkspacesService(prisma as unknown as PrismaService);

describe("WorkspacesService", () => {
  it("lists only non-deleted workspaces in the tenant", async () => {
    const prisma = createPrisma();
    prisma.workspace.findMany.mockResolvedValue([]);

    await createService(prisma).list("tenant-1");

    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        deletedAt: null
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
    });
  });

  it("creates a workspace under the current tenant", async () => {
    const prisma = createPrisma();
    prisma.workspace.create.mockResolvedValue({ id: "workspace-1" });

    await createService(prisma).create("tenant-1", {
      name: "Support",
      description: "Support team"
    });

    expect(prisma.workspace.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        name: "Support",
        description: "Support team",
        isDefault: false
      }
    });
  });

  it("throws when a workspace is outside the tenant scope", async () => {
    const prisma = createPrisma();
    prisma.workspace.findFirst.mockResolvedValue(null);

    await expect(createService(prisma).get("tenant-1", "workspace-2")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("updates member role only after finding an active tenant-scoped membership", async () => {
    const prisma = createPrisma();
    prisma.workspace.findFirst.mockResolvedValue({ id: "workspace-1" });
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: "member-1" });
    prisma.workspaceMember.update.mockResolvedValue({ id: "member-1" });

    await createService(prisma).updateMemberRole(
      "tenant-1",
      "workspace-1",
      "user-1",
      Role.ADMIN
    );

    expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        userId: "user-1",
        isActive: true
      }
    });
    expect(prisma.workspaceMember.update).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: { role: Role.ADMIN }
    });
  });
});
