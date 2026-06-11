import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuditAction, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

type MockPrisma = {
  user: {
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
  };
  refreshToken: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
    updateMany: jest.Mock<Promise<unknown>, [unknown]>;
  };
  auditLog: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

const createPrisma = (): MockPrisma => ({
  user: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>()
  },
  refreshToken: {
    create: jest.fn<Promise<unknown>, [unknown]>(),
    updateMany: jest.fn<Promise<unknown>, [unknown]>()
  },
  auditLog: {
    create: jest.fn<Promise<unknown>, [unknown]>()
  }
});

const createService = (prisma: MockPrisma): AuthService => {
  const configService = {
    get: (key: string): string | undefined =>
      key === "JWT_SECRET" ? "test-access-secret" : undefined
  };

  return new AuthService(
    prisma as unknown as PrismaService,
    new JwtService(),
    configService as ConfigService
  );
};

describe("AuthService", () => {
  it("logs in an active owner and stores a hashed refresh token", async () => {
    const prisma = createPrisma();
    const passwordHash = await bcrypt.hash("ChangeMe123!", 12);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "owner@omnichat.local",
      passwordHash,
      displayName: "Owner User",
      isActive: true,
      deletedAt: null,
      emailVerified: true,
      twoFaEnabled: false,
      memberships: [
        {
          tenantId: "tenant-1",
          workspaceId: "workspace-1",
          role: Role.OWNER,
          isActive: true
        }
      ]
    });
    prisma.refreshToken.create.mockResolvedValue({ id: "token-1" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const result = await createService(prisma).login(
      "owner@omnichat.local",
      "ChangeMe123!"
    );

    expect(result.user).toMatchObject({
      id: "user-1",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      role: Role.OWNER
    });
    expect(result.tokens.accessToken).toEqual(expect.any(String));
    expect(result.tokens.refreshToken.length).toBeGreaterThan(32);
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        tokenHash: expect.not.stringContaining(result.tokens.refreshToken)
      })
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.LOGIN
      }
    });
  });

  it("rejects invalid passwords", async () => {
    const prisma = createPrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "owner@omnichat.local",
      passwordHash: await bcrypt.hash("ChangeMe123!", 12),
      displayName: "Owner User",
      isActive: true,
      deletedAt: null,
      emailVerified: true,
      twoFaEnabled: false,
      memberships: []
    });

    await expect(
      createService(prisma).login("owner@omnichat.local", "wrong-password")
    ).rejects.toThrow("Invalid email or password");
  });

  it("revokes refresh tokens by hash on logout", async () => {
    const prisma = createPrisma();
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    const refreshToken = "refresh-token-value-that-is-long-enough";

    await createService(prisma).logout(refreshToken);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: createHash("sha256").update(refreshToken).digest("hex"),
        revokedAt: null
      },
      data: {
        revokedAt: expect.any(Date)
      }
    });
  });
});
