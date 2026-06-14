import { NotFoundException } from "@nestjs/common";
import { AuditAction, MessageDirection, MessageSource, MessageType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { InboxService } from "./inbox.service";

type MockPrisma = {
  conversation: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
  tenantSettings: {
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
    upsert: jest.Mock<Promise<unknown>, [unknown]>;
  };
  message: {
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
  };
  auditLog: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

const createPrisma = (): MockPrisma => ({
  conversation: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    findMany: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>()
  },
  tenantSettings: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    upsert: jest.fn<Promise<unknown>, [unknown]>()
  },
  message: {
    findMany: jest.fn<Promise<unknown>, [unknown]>()
  },
  auditLog: {
    create: jest.fn<Promise<unknown>, [unknown]>()
  }
});

const createService = (prisma: MockPrisma): InboxService =>
  new InboxService(prisma as unknown as PrismaService);

describe("InboxService", () => {
  it("lists active conversations inside the current tenant ordered by newest activity", async () => {
    const prisma = createPrisma();
    prisma.conversation.findMany.mockResolvedValue([
      {
        id: "conversation-1",
        tenantId: "tenant-1",
        displayName: "Customer A"
      }
    ]);

    await createService(prisma).listConversations("tenant-1", { limit: 10, offset: 20 });

    expect(prisma.conversation.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        deletedAt: null
      },
      include: {
        lineChannel: {
          select: {
            id: true,
            name: true,
            lineChannelId: true,
            badgeColor: true
          }
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            direction: true,
            type: true,
            text: true,
            rawPayload: true,
            createdAt: true,
            sentAt: true
          }
        }
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      skip: 20,
      take: 10
    });
  });

  it("moves a tenant conversation into in-progress status and starts the timer once", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1",
      status: "OPEN",
      inProgressStartedAt: null
    });
    prisma.conversation.update.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1",
      status: "IN_PROGRESS"
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await createService(prisma).updateStatus(
      "tenant-1",
      "user-1",
      "conversation-1",
      "IN_PROGRESS"
    );

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conversation-1" },
      data: {
        status: "IN_PROGRESS",
        inProgressStartedAt: expect.any(Date)
      }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.CONVERSATION_STATUS_CHANGED,
        targetType: "Conversation",
        targetId: "conversation-1",
        metadata: {
          previousStatus: "OPEN",
          status: "IN_PROGRESS"
        }
      })
    });
  });

  it("clears the in-progress timer when a conversation leaves in-progress status", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1",
      status: "IN_PROGRESS",
      inProgressStartedAt: new Date("2026-06-14T01:00:00.000Z")
    });
    prisma.conversation.update.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1",
      status: "OPEN"
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await createService(prisma).updateStatus("tenant-1", "user-1", "conversation-1", "OPEN");

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conversation-1" },
      data: {
        status: "OPEN",
        inProgressStartedAt: null
      }
    });
  });

  it("reads and updates the tenant inbox alert setting with audit log", async () => {
    const prisma = createPrisma();
    prisma.tenantSettings.findUnique.mockResolvedValue({ inProgressAlertMinutes: 15 });
    prisma.tenantSettings.upsert.mockResolvedValue({ inProgressAlertMinutes: 5 });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await expect(createService(prisma).getSettings("tenant-1")).resolves.toEqual({
      inProgressAlertMinutes: 15
    });
    await createService(prisma).updateSettings("tenant-1", "user-1", 5);

    expect(prisma.tenantSettings.upsert).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
      create: { tenantId: "tenant-1", inProgressAlertMinutes: 5 },
      update: { inProgressAlertMinutes: 5 },
      select: { inProgressAlertMinutes: true }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.INBOX_SETTINGS_UPDATED,
        targetType: "TenantSettings",
        targetId: "tenant-1",
        metadata: { inProgressAlertMinutes: 5 }
      })
    });
  });

  it("loads messages only after the conversation is verified inside tenant scope", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1"
    });
    prisma.message.findMany.mockResolvedValue([
      {
        id: "message-1",
        tenantId: "tenant-1",
        direction: MessageDirection.INBOUND,
        source: MessageSource.LINE,
        type: MessageType.TEXT,
        text: "hello"
      }
    ]);

    await createService(prisma).getConversationMessages("tenant-1", "conversation-1");

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: {
        id: "conversation-1",
        tenantId: "tenant-1",
        deletedAt: null
      }
    });
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        conversationId: "conversation-1",
        deletedAt: null
      },
      orderBy: { createdAt: "asc" },
      take: 200
    });
  });

  it("throws when a conversation is outside the tenant scope", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue(null);

    await expect(
      createService(prisma).getConversationMessages("tenant-1", "conversation-2")
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it("renames a customer conversation inside tenant scope and writes an audit log", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1",
      nickname: null
    });
    prisma.conversation.update.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1",
      nickname: "คุณเอฟ"
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await createService(prisma).renameCustomer(
      "tenant-1",
      "user-1",
      "conversation-1",
      "คุณเอฟ"
    );

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conversation-1" },
      data: { nickname: "คุณเอฟ" }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.CONVERSATION_CUSTOMER_RENAMED,
        targetType: "Conversation",
        targetId: "conversation-1",
        metadata: {
          previousNickname: null,
          nickname: "คุณเอฟ"
        }
      })
    });
  });
});
