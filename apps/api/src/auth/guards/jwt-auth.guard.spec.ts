import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

type MockPrisma = {
  user: {
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
  };
  workspaceMember: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

const createPrisma = (): MockPrisma => ({
  user: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>()
  },
  workspaceMember: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>()
  }
});

const createContext = (authorization?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authorization ? { authorization } : {}
      })
    })
  }) as never;

describe("JwtAuthGuard", () => {
  const jwtService = new JwtService({ secret: "test-jwt-secret" });
  const configService = {
    get: jest.fn((key: string) => (key === "JWT_SECRET" ? "test-jwt-secret" : undefined))
  } as unknown as ConfigService;

  it("rejects requests without a bearer token", async () => {
    const guard = new JwtAuthGuard(jwtService, configService, createPrisma() as unknown as PrismaService);

    await expect(guard.canActivate(createContext())).rejects.toThrow(UnauthorizedException);
  });

  it("rejects deactivated users after JWT verification", async () => {
    const prisma = createPrisma();
    const token = await jwtService.signAsync(
      {
        sub: "user-1",
        email: "owner@omnichat.local",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        role: Role.OWNER
      },
      { secret: "test-jwt-secret" }
    );
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      isActive: false,
      deletedAt: null,
      emailVerified: true,
      isSuperOwner: false
    });

    const guard = new JwtAuthGuard(jwtService, configService, prisma as unknown as PrismaService);

    await expect(guard.canActivate(createContext(`Bearer ${token}`))).rejects.toThrow("User is inactive");
    expect(prisma.workspaceMember.findFirst).not.toHaveBeenCalled();
  });

  it("rejects users whose workspace membership is no longer active", async () => {
    const prisma = createPrisma();
    const token = await jwtService.signAsync(
      {
        sub: "user-1",
        email: "owner@omnichat.local",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        role: Role.OWNER
      },
      { secret: "test-jwt-secret" }
    );
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      isActive: true,
      deletedAt: null,
      emailVerified: true,
      isSuperOwner: false
    });
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    const guard = new JwtAuthGuard(jwtService, configService, prisma as unknown as PrismaService);

    await expect(guard.canActivate(createContext(`Bearer ${token}`))).rejects.toThrow(
      "Workspace membership is no longer active"
    );
  });

  it("allows active users with valid membership", async () => {
    const prisma = createPrisma();
    const token = await jwtService.signAsync(
      {
        sub: "user-1",
        email: "owner@omnichat.local",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        role: Role.OWNER
      },
      { secret: "test-jwt-secret" }
    );
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      isActive: true,
      deletedAt: null,
      emailVerified: true,
      isSuperOwner: false
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: "member-1" });

    const request = { headers: { authorization: `Bearer ${token}` }, user: undefined as never };
    const guard = new JwtAuthGuard(jwtService, configService, prisma as unknown as PrismaService);

    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => request })
      } as never)
    ).resolves.toBe(true);
    expect(request.user).toMatchObject({
      sub: "user-1",
      tenantId: "tenant-1",
      workspaceId: "workspace-1"
    });
  });

  it("accepts access tokens from HttpOnly cookies", async () => {
    const prisma = createPrisma();
    const token = await jwtService.signAsync(
      {
        sub: "user-1",
        email: "owner@omnichat.local",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        role: Role.OWNER
      },
      { secret: "test-jwt-secret" }
    );
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      isActive: true,
      deletedAt: null,
      emailVerified: true,
      isSuperOwner: false
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: "member-1" });

    const request = {
      headers: { cookie: `omnichat.accessToken=${encodeURIComponent(token)}` },
      user: undefined as never
    };
    const guard = new JwtAuthGuard(jwtService, configService, prisma as unknown as PrismaService);

    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => request })
      } as never)
    ).resolves.toBe(true);
    expect((request.user as { sub: string }).sub).toBe("user-1");
  });
});
