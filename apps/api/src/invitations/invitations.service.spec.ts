import { ConflictException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditAction, InvitationStatus, Role } from "@prisma/client";
import { PlanLimitExceededException } from "../common/exceptions/plan-limit-exceeded.exception";
import { MailService } from "../mail/mail.service";
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
  tenant: {
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
  };
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
  planLimit: {
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
  };
  workspaceMember: {
    count: jest.Mock<Promise<number>, [unknown]>;
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
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
  tenant: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>()
  },
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
  planLimit: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>()
  },
  workspaceMember: {
    count: jest.fn<Promise<number>, [unknown]>(),
    findMany: jest.fn<Promise<unknown>, [unknown]>()
  },
  $transaction: jest.fn<Promise<unknown>, [(tx: MockTransaction) => Promise<unknown>]>(
    (callback) => callback(tx)
  )
});

const createMail = (): Pick<MailService, "sendInvitationEmail"> => ({
  sendInvitationEmail: jest.fn<Promise<void>, [Parameters<MailService["sendInvitationEmail"]>[0]]>().mockResolvedValue(undefined)
});

const createConfig = (values: Record<string, string> = {}): Pick<ConfigService, "get"> => ({
  get: jest.fn((key: string) => values[key])
});

const createService = (
  prisma: MockPrisma,
  mailService: Pick<MailService, "sendInvitationEmail"> = createMail(),
  configService: Pick<ConfigService, "get"> = createConfig({ APP_BASE_URL: "http://localhost:3000" })
): InvitationsService =>
  new InvitationsService(
    prisma as unknown as PrismaService,
    mailService as MailService,
    configService as ConfigService
  );

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
    const mailService = createMail();
    prisma.tenant.findUnique.mockResolvedValue({ id: "tenant-1", name: "Tenant" });
    prisma.workspace.findFirst.mockResolvedValue({ id: "workspace-1", name: "Support" });
    prisma.invitation.create.mockResolvedValue(pendingInvitation);
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const result = await createService(prisma, mailService).create("tenant-1", "owner-1", {
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
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      select: { id: true, name: true }
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
    expect(mailService.sendInvitationEmail).not.toHaveBeenCalled();
    expect(result.inviteToken).toEqual(expect.any(String));
    expect(result.inviteUrl).toContain("/invite/accept?token=");
  });

  it("sends invitation email when INVITE_SEND_EMAIL is enabled", async () => {
    const prisma = createPrisma();
    const mailService = createMail();
    const configService = createConfig({
      APP_BASE_URL: "http://localhost:3000",
      INVITE_SEND_EMAIL: "true"
    });
    prisma.tenant.findUnique.mockResolvedValue({ id: "tenant-1", name: "Tenant" });
    prisma.workspace.findFirst.mockResolvedValue({ id: "workspace-1", name: "Support" });
    prisma.invitation.create.mockResolvedValue(pendingInvitation);
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const result = await createService(prisma, mailService, configService).create("tenant-1", "owner-1", {
      workspaceId: "workspace-1",
      email: "Agent@Example.com",
      role: Role.AGENT
    });

    expect(mailService.sendInvitationEmail).toHaveBeenCalledWith({
      to: "agent@example.com",
      inviteToken: result.inviteToken,
      tenantName: "Tenant",
      workspaceName: "Support",
      expiresAt: pendingInvitation.expiresAt
    });
  });

  it("rejects create when invitation email delivery fails and email sending is enabled", async () => {
    const prisma = createPrisma();
    const mailService = createMail();
    const configService = createConfig({ INVITE_SEND_EMAIL: "true" });
    jest
      .mocked(mailService.sendInvitationEmail)
      .mockRejectedValue(new Error("Email delivery failed"));
    prisma.tenant.findUnique.mockResolvedValue({ id: "tenant-1", name: "Tenant" });
    prisma.workspace.findFirst.mockResolvedValue({ id: "workspace-1", name: "Support" });
    prisma.invitation.create.mockResolvedValue(pendingInvitation);
    prisma.invitation.update.mockResolvedValue({
      ...pendingInvitation,
      status: InvitationStatus.REVOKED
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await expect(
      createService(prisma, mailService, configService).create("tenant-1", "owner-1", {
        workspaceId: "workspace-1",
        email: "Agent@Example.com",
        role: Role.AGENT
      })
    ).rejects.toThrow("Email delivery failed");
    expect(prisma.invitation.update).toHaveBeenCalledWith({
      where: { id: "invitation-1" },
      data: { status: InvitationStatus.REVOKED }
    });
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
    prisma.tenant.findUnique.mockResolvedValue({ planId: "free" });
    prisma.planLimit.findUnique.mockResolvedValue({ maxAgents: 2 });
    prisma.workspaceMember.findMany.mockResolvedValue([{ userId: "user-existing" }]);
    tx.user.create.mockResolvedValue({
      id: "user-1",
      email: "agent@example.com"
    });

    await createService(prisma).accept("token-1", {
      username: "agentuser",
      displayName: "Agent User",
      password: "ChangeMe123!"
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "agent@example.com",
        username: "agentuser",
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
        username: "agentuser",
        displayName: "Agent User",
        password: "ChangeMe123!"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects accept when the username is already taken", async () => {
    const prisma = createPrisma();
    prisma.invitation.findUnique.mockResolvedValue(pendingInvitation);
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // email check
      .mockResolvedValueOnce({ id: "user-2" }); // username check

    await expect(
      createService(prisma).accept("token-1", {
        username: "takenusername",
        displayName: "Agent User",
        password: "ChangeMe123!"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects accept when the tenant agent limit is reached", async () => {
    const prisma = createPrisma();
    prisma.invitation.findUnique.mockResolvedValue(pendingInvitation);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.tenant.findUnique.mockResolvedValue({ planId: "free" });
    prisma.planLimit.findUnique.mockResolvedValue({ maxAgents: 2 });
    prisma.workspaceMember.findMany.mockResolvedValue([{ userId: "user-1" }, { userId: "user-2" }]);
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await expect(
      createService(prisma).accept("token-1", {
        username: "agentuser",
        displayName: "Agent User",
        password: "ChangeMe123!"
      })
    ).rejects.toBeInstanceOf(PlanLimitExceededException);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        action: AuditAction.PLAN_LIMIT_EXCEEDED,
        targetType: "WorkspaceMember"
      })
    });
  });
});
