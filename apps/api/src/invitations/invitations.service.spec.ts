import { ConflictException, NotFoundException } from "@nestjs/common";
import { AuditAction, InvitationStatus, Role } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { InvitationsService } from "./invitations.service";

type MockTransaction = {
  user: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
  workspaceMember: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
  invitation: {
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
  auditLog: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

type MockPrisma = {
  workspace: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
  };
  invitation: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
  auditLog: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
  user: {
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
  };
  $transaction: jest.Mock<Promise<unknown>, [(tx: MockTransaction) => Promise<unknown>]>;
};

const createTx = (): MockTransaction => ({
  user: {
    create: jest.fn<Promise<unknown>, [unknown]>()
  },
  workspaceMember: {
    create: jest.fn<Promise<unknown>, [unknown]>()
  },
  invitation: {
    update: jest.fn<Promise<unknown>, [unknown]>()
  },
  auditLog: {
    create: jest.fn<Promise<unknown>, [unknown]>()
  }
});

const createPrisma = (tx = createTx()): MockPrisma => ({
  workspace: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>()
  },
  invitation: {
    create: jest.fn<Promise<unknown>, [unknown]>(),
    findMany: jest.fn<Promise<unknown>, [unknown]>(),
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>()
  },
  auditLog: {
    create: jest.fn<Promise<unknown>, [unknown]>()
  },
  user: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>()
  },
  $transaction: jest.fn<Promise<unknown>, [(tx: MockTransaction) => Promise<unknown>]>(
    (callback) => callback(tx)
  )
});

const createService = (prisma: MockPrisma): InvitationsService =>
  new InvitationsService(prisma as unknown as PrismaService);

const pendingInvitation = {
  id: "invitation-1",
  tenantId: "tenant-1",
  workspaceId: "workspace-1",
  invitedByUserId: "owner-1",
  email: "agent@example.com",
  role: Role.AGENT,
  token: "token-1",
  status: InvitationStatus.PENDING,
  expiresAt: new Date(Date.now() + 60_000),
  acceptedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  tenant: {
    id: "tenant-1",
    name: "Tenant",
    slug: "tenant"
  },
  workspace: {
    id: "workspace-1",
    name: "Support"
  }
};

describe("InvitationsService", () => {
  it("creates tenant-scoped invitations and audit logs the invite", async () => {
    const prisma = createPrisma();
    prisma.workspace.findFirst.mockResolvedValue({ id: "workspace-1" });
    prisma.invitation.create.mockResolvedValue(pendingInvitation);
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const result = await createService(prisma).create("tenant-1", "owner-1", {
      workspaceId: "workspace-1",
      email: "Agent@Example.com",
      role: Role.AGENT
    });

    expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
      where: {
        id: "workspace-1",
        tenantId: "tenant-1",
        deletedAt: null
      }
    });
    expect(prisma.invitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        invitedByUserId: "owner-1",
        email: "agent@example.com",
        role: Role.AGENT,
        token: expect.any(String),
        expiresAt: expect.any(Date)
      })
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "owner-1",
        action: AuditAction.USER_INVITED,
        targetType: "Invitation",
        targetId: "invitation-1"
      })
    });
    expect(result.inviteToken).toEqual(expect.any(String));
  });

  it("does not revoke invitations outside the current tenant", async () => {
    const prisma = createPrisma();
    prisma.invitation.findFirst.mockResolvedValue(null);

    await expect(
      createService(prisma).revoke("tenant-1", "invitation-2")
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.invitation.findFirst).toHaveBeenCalledWith({
      where: {
        id: "invitation-2",
        tenantId: "tenant-1"
      }
    });
  });

  it("marks expired pending invitations as expired during verify", async () => {
    const prisma = createPrisma();
    prisma.invitation.findUnique.mockResolvedValue({
      ...pendingInvitation,
      expiresAt: new Date(Date.now() - 60_000)
    });
    prisma.invitation.update.mockResolvedValue({
      ...pendingInvitation,
      status: InvitationStatus.EXPIRED
    });

    await expect(createService(prisma).verify("token-1")).rejects.toThrow(
      "Invitation expired"
    );
    expect(prisma.invitation.update).toHaveBeenCalledWith({
      where: { id: "invitation-1" },
      data: { status: InvitationStatus.EXPIRED }
    });
  });

  it("accepts an invitation by creating the user, membership, and accepted status in one transaction", async () => {
    const tx = createTx();
    const prisma = createPrisma(tx);
    prisma.invitation.findUnique.mockResolvedValue(pendingInvitation);
    prisma.user.findUnique.mockResolvedValue(null);
    tx.user.create.mockResolvedValue({
      id: "user-1",
      email: "agent@example.com"
    });

    await createService(prisma).accept("token-1", {
      displayName: "Agent User",
      password: "ChangeMe123!"
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "agent@example.com",
        displayName: "Agent User",
        passwordHash: expect.any(String),
        emailVerified: true,
        emailVerifiedAt: expect.any(Date)
      })
    });
    expect(tx.workspaceMember.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        userId: "user-1",
        role: Role.AGENT
      }
    });
    expect(tx.invitation.update).toHaveBeenCalledWith({
      where: { id: "invitation-1" },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: expect.any(Date)
      }
    });
  });

  it("rejects accept when a user already exists for the invitation email", async () => {
    const prisma = createPrisma();
    prisma.invitation.findUnique.mockResolvedValue(pendingInvitation);
    prisma.user.findUnique.mockResolvedValue({ id: "user-1" });

    await expect(
      createService(prisma).accept("token-1", {
        displayName: "Agent User",
        password: "ChangeMe123!"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
