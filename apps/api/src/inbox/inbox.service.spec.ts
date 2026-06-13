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

    await createService(prisma).listConversations("tenant-1");

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
      take: 100
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
