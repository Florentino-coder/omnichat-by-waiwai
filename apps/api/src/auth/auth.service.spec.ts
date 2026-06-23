import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuditAction, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash } from "crypto";

jest.mock("otplib", () => ({
  OTP: class {
    generateSecret(): string {
      return "MOCKSECRET123456";
    }

    verifySync(options: { token: string }): { valid: boolean } {
      return { valid: options.token === "123456" };
    }

    generateURI(options: { issuer: string; label: string; secret: string }): string {
      return `otpauth://totp/${options.issuer}:${options.label}?secret=${options.secret}&issuer=${options.issuer}`;
    }
  }
}));

import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";
import { CryptoSecretService } from "./crypto-secret.service";
import { RefreshSessionService } from "./refresh-session.service";
import { TotpService } from "./totp.service";

type MockPrisma = {
  user: {
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
  workspaceMember: {
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
  };
  refreshToken: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
    updateMany: jest.Mock<Promise<unknown>, [unknown]>;
  };
  auditLog: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

type MockRefreshSessionService = {
  store: jest.Mock<Promise<void>, Parameters<RefreshSessionService["store"]>>;
  get: jest.Mock<Promise<Awaited<ReturnType<RefreshSessionService["get"]>>>, Parameters<RefreshSessionService["get"]>>;
  delete: jest.Mock<Promise<void>, Parameters<RefreshSessionService["delete"]>>;
  deleteAllForUser: jest.Mock<Promise<void>, Parameters<RefreshSessionService["deleteAllForUser"]>>;
};

type MockCryptoSecretService = {
  encrypt: jest.Mock<string, Parameters<CryptoSecretService["encrypt"]>>;
  decrypt: jest.Mock<string, Parameters<CryptoSecretService["decrypt"]>>;
};

type MockTotpService = {
  generateSetup: jest.Mock<ReturnType<TotpService["generateSetup"]>, Parameters<TotpService["generateSetup"]>>;
  verify: jest.Mock<boolean, Parameters<TotpService["verify"]>>;
};

const createPrisma = (): MockPrisma => ({
  user: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>()
  },
  workspaceMember: {
    findMany: jest.fn<Promise<unknown>, [unknown]>(),
    findFirst: jest.fn<Promise<unknown>, [unknown]>()
  },
  refreshToken: {
    create: jest.fn<Promise<unknown>, [unknown]>(),
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    updateMany: jest.fn<Promise<unknown>, [unknown]>()
  },
  auditLog: {
    create: jest.fn<Promise<unknown>, [unknown]>()
  }
});

const createRefreshSessions = (): MockRefreshSessionService => ({
  store: jest.fn<Promise<void>, Parameters<RefreshSessionService["store"]>>().mockResolvedValue(undefined),
  get: jest.fn<Promise<Awaited<ReturnType<RefreshSessionService["get"]>>>, Parameters<RefreshSessionService["get"]>>(),
  delete: jest.fn<Promise<void>, Parameters<RefreshSessionService["delete"]>>().mockResolvedValue(undefined),
  deleteAllForUser: jest
    .fn<Promise<void>, Parameters<RefreshSessionService["deleteAllForUser"]>>()
    .mockResolvedValue(undefined)
});

const createCrypto = (): MockCryptoSecretService => ({
  encrypt: jest.fn<string, Parameters<CryptoSecretService["encrypt"]>>(
    (value) => `encrypted:${value}`
  ),
  decrypt: jest.fn<string, Parameters<CryptoSecretService["decrypt"]>>(
    (value: string) => value.replace("encrypted:", "")
  )
});

const createTotp = (): MockTotpService => ({
  generateSetup: jest
    .fn<ReturnType<TotpService["generateSetup"]>, Parameters<TotpService["generateSetup"]>>()
    .mockReturnValue({
      secret: "totp-secret",
      otpauthUri: "otpauth://totp/OmniChat:owner@omnichat.local?issuer=OmniChat"
    }),
  verify: jest.fn<boolean, Parameters<TotpService["verify"]>>().mockReturnValue(true)
});

const createService = (
  prisma: MockPrisma,
  refreshSessions = createRefreshSessions(),
  crypto = createCrypto(),
  totp = createTotp()
): AuthService => {
  const configService = {
    get: (key: string): string | undefined =>
      key === "JWT_SECRET" ? "test-access-secret" : undefined
  };

  return new AuthService(
    prisma as unknown as PrismaService,
    new JwtService(),
    configService as ConfigService,
    refreshSessions as unknown as RefreshSessionService,
    crypto as unknown as CryptoSecretService,
    totp as unknown as TotpService
  );
};

const activeMembership = {
  tenantId: "tenant-1",
  workspaceId: "workspace-1",
  role: Role.OWNER,
  isActive: true
};

const createLoginUser = async (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  email: "owner@omnichat.local",
  passwordHash: await bcrypt.hash("ChangeMe123!", 12),
  displayName: "Owner User",
  isActive: true,
  deletedAt: null,
  emailVerified: true,
  twoFaEnabled: false,
  twoFaSecret: null,
  memberships: [activeMembership],
  ...overrides
});

const hashToken = (refreshToken: string): string =>
  createHash("sha256").update(refreshToken).digest("hex");

describe("AuthService", () => {
  it("lists active tenant memberships with tenant and workspace labels", async () => {
    const prisma = createPrisma();
    prisma.workspaceMember.findMany.mockResolvedValue([
      {
        id: "member-1",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        role: Role.OWNER,
        tenant: { id: "tenant-1", name: "Jinbao", slug: "jinbao", logoUrl: null },
        workspace: { id: "workspace-1", name: "Sales", isDefault: true }
      }
    ]);

    await expect(createService(prisma).listMemberships("user-1")).resolves.toEqual([
      {
        membershipId: "member-1",
        tenantId: "tenant-1",
        tenantName: "Jinbao",
        tenantSlug: "jinbao",
        tenantLogoUrl: null,
        workspaceId: "workspace-1",
        workspaceName: "Sales",
        isDefaultWorkspace: true,
        role: Role.OWNER
      }
    ]);
    expect(prisma.workspaceMember.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        isActive: true,
        tenant: { isActive: true, deletedAt: null },
        workspace: { deletedAt: null }
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true, logoUrl: true } },
        workspace: { select: { id: true, name: true, isDefault: true } }
      },
      orderBy: [{ tenant: { name: "asc" } }, { workspace: { name: "asc" } }]
    });
  });

  it("switches to an owned workspace, issues scoped tokens, and audits the switch", async () => {
    const prisma = createPrisma();
    const refreshSessions = createRefreshSessions();
    prisma.workspaceMember.findFirst.mockResolvedValue({
      tenantId: "tenant-2",
      workspaceId: "workspace-2",
      role: Role.ADMIN,
      isActive: true
    });
    prisma.refreshToken.create.mockResolvedValue({ id: "token-1" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const result = await createService(prisma, refreshSessions).switchTenant(
      {
        sub: "user-1",
        email: "owner@omnichat.local",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        role: Role.OWNER
      },
      "workspace-2"
    );

    expect(result.user).toMatchObject({
      id: "user-1",
      email: "owner@omnichat.local",
      tenantId: "tenant-2",
      workspaceId: "workspace-2",
      role: Role.ADMIN
    });
    expect(refreshSessions.store).toHaveBeenCalledWith(
      hashToken(result.tokens.refreshToken),
      expect.objectContaining({
        userId: "user-1",
        tenantId: "tenant-2",
        workspaceId: "workspace-2",
        role: Role.ADMIN
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-2",
        userId: "user-1",
        action: AuditAction.TENANT_SWITCHED,
        metadata: {
          fromTenantId: "tenant-1",
          fromWorkspaceId: "workspace-1",
          toWorkspaceId: "workspace-2"
        }
      }
    });
  });

  it("rejects tenant switch to a workspace the user does not belong to", async () => {
    const prisma = createPrisma();
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(
      createService(prisma).switchTenant(
        {
          sub: "user-1",
          email: "owner@omnichat.local",
          tenantId: "tenant-1",
          workspaceId: "workspace-1",
          role: Role.OWNER
        },
        "workspace-other"
      )
    ).rejects.toThrow("Workspace membership not found");
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("logs in an active owner and stores hashed refresh sessions in DB and Redis", async () => {
    const prisma = createPrisma();
    const refreshSessions = createRefreshSessions();
    prisma.user.findFirst.mockResolvedValue(await createLoginUser());
    prisma.refreshToken.create.mockResolvedValue({ id: "token-1" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const result = await createService(prisma, refreshSessions).login(
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
        tokenHash: expect.not.stringContaining(result.tokens.refreshToken),
        expiresAt: expect.any(Date)
      })
    });
    expect(refreshSessions.store).toHaveBeenCalledWith(
      hashToken(result.tokens.refreshToken),
      {
        userId: "user-1",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        role: Role.OWNER,
        expiresAt: expect.any(String)
      }
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.LOGIN
      }
    });
  });

  it("revokes the DB refresh token when Redis session storage fails during login", async () => {
    const prisma = createPrisma();
    const refreshSessions = createRefreshSessions();
    const redisError = new Error("Redis unavailable");
    prisma.user.findFirst.mockResolvedValue(await createLoginUser());
    prisma.refreshToken.create.mockResolvedValue({ id: "token-1" });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    refreshSessions.store.mockRejectedValue(redisError);

    await expect(
      createService(prisma, refreshSessions).login("owner@omnichat.local", "ChangeMe123!")
    ).rejects.toThrow("Redis unavailable");

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: expect.any(String),
        revokedAt: null
      },
      data: {
        revokedAt: expect.any(Date)
      }
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalledWith({
      data: expect.objectContaining({ action: AuditAction.LOGIN })
    });
  });

  it("rejects invalid passwords", async () => {
    const prisma = createPrisma();
    prisma.user.findFirst.mockResolvedValue(await createLoginUser());
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await expect(
      createService(prisma).login("owner@omnichat.local", "wrong-password")
    ).rejects.toThrow("Invalid email or password");
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.LOGIN_FAILED,
        metadata: {
          reason: "INVALID_CREDENTIALS"
        }
      }
    });
  });

  it("does not audit unknown email login failures without safe tenant context", async () => {
    const prisma = createPrisma();
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      createService(prisma).login("unknown@omnichat.local", "wrong-password")
    ).rejects.toThrow("Invalid email or password");
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("rotates refresh token in Redis and DB before revoking the old session", async () => {
    const prisma = createPrisma();
    const refreshSessions = createRefreshSessions();
    refreshSessions.get.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      role: Role.OWNER,
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    prisma.refreshToken.findUnique.mockResolvedValue({
      userId: "user-1",
      tokenHash: hashToken("old-refresh-token"),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: await createLoginUser()
    });
    prisma.refreshToken.create.mockResolvedValue({ id: "new-token" });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const tokens = await createService(prisma, refreshSessions).refresh("old-refresh-token");

    expect(tokens.refreshToken).toEqual(expect.any(String));
    expect(refreshSessions.get).toHaveBeenCalledWith(hashToken("old-refresh-token"));
    expect(refreshSessions.store.mock.invocationCallOrder[0]).toBeLessThan(
      refreshSessions.delete.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER
    );
    expect(prisma.refreshToken.create.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.refreshToken.updateMany.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER
    );
    expect(refreshSessions.delete).toHaveBeenCalledWith(hashToken("old-refresh-token"), "user-1");
  });

  it("reissues tokens using the refresh session tenant context instead of primary membership", async () => {
    const prisma = createPrisma();
    const refreshSessions = createRefreshSessions();
    const secondaryMembership = {
      tenantId: "tenant-2",
      workspaceId: "workspace-2",
      role: Role.AGENT,
      isActive: true
    };
    refreshSessions.get.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-2",
      workspaceId: "workspace-2",
      role: Role.AGENT,
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    prisma.refreshToken.findUnique.mockResolvedValue({
      userId: "user-1",
      tokenHash: hashToken("session-refresh-token"),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: await createLoginUser({
        memberships: [activeMembership, secondaryMembership]
      })
    });
    prisma.refreshToken.create.mockResolvedValue({ id: "new-token" });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await createService(prisma, refreshSessions).refresh("session-refresh-token");

    expect(refreshSessions.store).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        tenantId: "tenant-2",
        workspaceId: "workspace-2",
        role: Role.AGENT
      })
    );
  });

  it("rejects refresh when the session tenant membership is no longer active", async () => {
    const prisma = createPrisma();
    const refreshSessions = createRefreshSessions();
    refreshSessions.get.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-2",
      workspaceId: "workspace-2",
      role: Role.AGENT,
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    prisma.refreshToken.findUnique.mockResolvedValue({
      userId: "user-1",
      tokenHash: hashToken("session-refresh-token"),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: await createLoginUser()
    });

    await expect(
      createService(prisma, refreshSessions).refresh("session-refresh-token")
    ).rejects.toThrow("Workspace membership is no longer active");
  });

  it("refreshes tokens for 2FA-enabled users without requiring a TOTP code", async () => {
    const prisma = createPrisma();
    const refreshSessions = createRefreshSessions();
    refreshSessions.get.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      role: Role.OWNER,
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    prisma.refreshToken.findUnique.mockResolvedValue({
      userId: "user-1",
      tokenHash: hashToken("old-refresh-token"),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: await createLoginUser({
        twoFaEnabled: true,
        twoFaSecret: "encrypted:totp-secret"
      })
    });
    prisma.refreshToken.create.mockResolvedValue({ id: "new-token" });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      createService(prisma, refreshSessions).refresh("old-refresh-token")
    ).resolves.toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String)
    });
  });

  it("rejects refresh when Redis session is missing", async () => {
    const prisma = createPrisma();
    const refreshSessions = createRefreshSessions();
    refreshSessions.get.mockResolvedValue(null);
    prisma.refreshToken.findUnique.mockResolvedValue({
      userId: "user-1",
      tokenHash: hashToken("refresh-token"),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: await createLoginUser()
    });

    await expect(
      createService(prisma, refreshSessions).refresh("refresh-token")
    ).rejects.toThrow("Invalid refresh token");
  });

  it("detects refresh reuse, revokes all sessions, deletes Redis sessions, and audits", async () => {
    const prisma = createPrisma();
    const refreshSessions = createRefreshSessions();
    prisma.refreshToken.findUnique.mockResolvedValue({
      userId: "user-1",
      tokenHash: hashToken("reused-refresh-token"),
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user: await createLoginUser()
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await expect(
      createService(prisma, refreshSessions).refresh("reused-refresh-token")
    ).rejects.toThrow("Refresh token reuse detected");

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        revokedAt: null
      },
      data: {
        revokedAt: expect.any(Date)
      }
    });
    expect(refreshSessions.deleteAllForUser).toHaveBeenCalledWith("user-1");
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.LOGIN_FAILED,
        metadata: {
          reason: "REFRESH_REUSE_DETECTED"
        }
      })
    });
  });

  it("revokes refresh tokens in DB and Redis on logout and audits when context is resolvable", async () => {
    const prisma = createPrisma();
    const refreshSessions = createRefreshSessions();
    refreshSessions.get.mockResolvedValue({
      userId: "user-1",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      role: Role.OWNER,
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    const refreshToken = "refresh-token-value-that-is-long-enough";

    await createService(prisma, refreshSessions).logout(refreshToken);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: hashToken(refreshToken),
        revokedAt: null
      },
      data: {
        revokedAt: expect.any(Date)
      }
    });
    expect(refreshSessions.delete).toHaveBeenCalledWith(hashToken(refreshToken), "user-1");
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.LOGOUT
      }
    });
  });

  it("sets up, verifies, and disables two-factor authentication with audit logs", async () => {
    const prisma = createPrisma();
    const crypto = createCrypto();
    const totp = createTotp();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "owner@omnichat.local",
      twoFaSecret: "encrypted:totp-secret",
      twoFaEnabled: false
    });
    prisma.user.update.mockResolvedValue({ id: "user-1" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    const service = createService(prisma, createRefreshSessions(), crypto, totp);

    await expect(
      service.setupTwoFa({
        userId: "user-1",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        role: Role.OWNER,
        email: "owner@omnichat.local"
      })
    ).resolves.toEqual({
      otpauthUri: "otpauth://totp/OmniChat:owner@omnichat.local?issuer=OmniChat"
    });
    await service.verifyTwoFa(
      { sub: "user-1", tenantId: "tenant-1", workspaceId: "workspace-1", role: Role.OWNER, email: "owner@omnichat.local" },
      "123456"
    );
    await service.disableTwoFa(
      { sub: "user-1", tenantId: "tenant-1", workspaceId: "workspace-1", role: Role.OWNER, email: "owner@omnichat.local" },
      "123456"
    );

    expect(crypto.encrypt).toHaveBeenCalledWith("totp-secret");
    expect(totp.verify).toHaveBeenCalledWith("totp-secret", "123456");
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.TWO_FA_ENABLED
      }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.TWO_FA_DISABLED
      }
    });
  });

  it("rejects invalid two-factor verification codes", async () => {
    const prisma = createPrisma();
    const totp = createTotp();
    totp.verify.mockReturnValue(false);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "owner@omnichat.local",
      twoFaSecret: "encrypted:totp-secret",
      twoFaEnabled: false
    });

    await expect(
      createService(prisma, createRefreshSessions(), createCrypto(), totp).verifyTwoFa(
        { sub: "user-1", tenantId: "tenant-1", workspaceId: "workspace-1", role: Role.OWNER, email: "owner@omnichat.local" },
        "000000"
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("requires and verifies real TOTP codes during login", async () => {
    const prisma = createPrisma();
    const crypto = createCrypto();
    const totp = createTotp();
    prisma.user.findFirst.mockResolvedValue(
      await createLoginUser({
        twoFaEnabled: true,
        twoFaSecret: "encrypted:totp-secret"
      })
    );
    prisma.refreshToken.create.mockResolvedValue({ id: "token-1" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await expect(
      createService(prisma, createRefreshSessions(), crypto, totp).login(
        "owner@omnichat.local",
        "ChangeMe123!"
      )
    ).rejects.toThrow("Two-factor code is required");
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.LOGIN_FAILED,
        metadata: {
          reason: "MISSING_TOTP"
        }
      })
    });

    totp.verify.mockReturnValue(false);
    await expect(
      createService(prisma, createRefreshSessions(), crypto, totp).login(
        "owner@omnichat.local",
        "ChangeMe123!",
        "000000"
      )
    ).rejects.toThrow("Invalid two-factor code");
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.LOGIN_FAILED
      })
    });

    totp.verify.mockReturnValue(true);
    await expect(
      createService(prisma, createRefreshSessions(), crypto, totp).login(
        "owner@omnichat.local",
        "ChangeMe123!",
        "123456"
      )
    ).resolves.toMatchObject({
      user: {
        id: "user-1"
      }
    });
    expect(crypto.decrypt).toHaveBeenCalledWith("encrypted:totp-secret");
    expect(totp.verify).toHaveBeenCalledWith("totp-secret", "123456");
  });
});
