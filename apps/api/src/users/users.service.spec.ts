import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

type MockPrisma = {
  user: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

const createPrisma = (): MockPrisma => ({
  user: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>()
  }
});

const createService = (prisma: MockPrisma): UsersService =>
  new UsersService(prisma as unknown as PrismaService);

describe("UsersService", () => {
  it("loads profile only when user has active membership in tenant", async () => {
    const prisma = createPrisma();
    prisma.user.findFirst.mockResolvedValue({ id: "user-1" });

    await createService(prisma).getMe("user-1", "tenant-1");

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: "user-1",
        deletedAt: null,
        memberships: {
          some: {
            tenantId: "tenant-1",
            isActive: true
          }
        }
      },
      select: expect.not.objectContaining({
        passwordHash: expect.anything()
      })
    });
  });

  it("throws when user is outside tenant scope", async () => {
    const prisma = createPrisma();
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(createService(prisma).getMe("user-1", "tenant-2")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("updates profile only after tenant-scoped profile lookup", async () => {
    const prisma = createPrisma();
    prisma.user.findFirst.mockResolvedValue({ id: "user-1" });
    prisma.user.update.mockResolvedValue({ id: "user-1" });

    await createService(prisma).updateMe("user-1", "tenant-1", {
      displayName: "New Name"
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { displayName: "New Name" }
    });
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(2);
  });
});
