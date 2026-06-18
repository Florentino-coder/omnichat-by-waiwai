import { ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  AuditAction,
  ConversationPriority,
  MessageDirection,
  MessageSource,
  MessageType,
  Role
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { InboxService } from "./inbox.service";

type MockPrisma = {
  conversation: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
  workspaceMember: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
  };
  conversationTag: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
  conversationTagLink: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    create: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
  conversationInternalNote: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
  savedReply: {
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
    create: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
  };
  lineChannel: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
  };
  tenantSettings: {
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
    upsert: jest.Mock<Promise<unknown>, [unknown]>;
  };
  message: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    findMany: jest.Mock<Promise<unknown>, [unknown]>;
    updateMany: jest.Mock<Promise<unknown>, [unknown]>;
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
  workspaceMember: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>()
  },
  conversationTag: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    findMany: jest.fn<Promise<unknown>, [unknown]>(),
    create: jest.fn<Promise<unknown>, [unknown]>()
  },
  conversationTagLink: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    create: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>()
  },
  conversationInternalNote: {
    create: jest.fn<Promise<unknown>, [unknown]>(),
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>()
  },
  savedReply: {
    findMany: jest.fn<Promise<unknown>, [unknown]>(),
    create: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>(),
    findFirst: jest.fn<Promise<unknown>, [unknown]>()
  },
  lineChannel: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>()
  },
  tenantSettings: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    upsert: jest.fn<Promise<unknown>, [unknown]>()
  },
  message: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    findMany: jest.fn<Promise<unknown>, [unknown]>(),
    updateMany: jest.fn<Promise<unknown>, [unknown]>()
  },
  auditLog: {
    create: jest.fn<Promise<unknown>, [unknown]>()
  }
});

import { CryptoSecretService } from "../auth/crypto-secret.service";

const mockCryptoSecretService = {
  decrypt: jest.fn().mockImplementation((val) => val),
  encrypt: jest.fn().mockImplementation((val) => val)
} as unknown as CryptoSecretService;

const createService = (prisma: MockPrisma): InboxService =>
  new InboxService(
    prisma as unknown as PrismaService,
    mockCryptoSecretService
  );

type Stage3BInboxService = InboxService & {
  assignConversation: (
    tenantId: string,
    userId: string,
    conversationId: string,
    memberId: string | null
  ) => Promise<unknown>;
  updatePriority: (
    tenantId: string,
    userId: string,
    conversationId: string,
    priority: ConversationPriority
  ) => Promise<unknown>;
  createTag: (
    tenantId: string,
    userId: string,
    input: { name: string; color?: string }
  ) => Promise<unknown>;
  addConversationTag: (
    tenantId: string,
    userId: string,
    conversationId: string,
    tagId: string
  ) => Promise<unknown>;
  removeConversationTag: (
    tenantId: string,
    userId: string,
    conversationId: string,
    tagId: string
  ) => Promise<unknown>;
  createNote: (
    tenantId: string,
    userId: string,
    conversationId: string,
    body: string
  ) => Promise<unknown>;
  deleteNote: (
    tenantId: string,
    userId: string,
    role: Role,
    conversationId: string,
    noteId: string
  ) => Promise<unknown>;
  listSavedReplies: (tenantId: string, options?: { lineChannelId?: string }) => Promise<unknown>;
  createSavedReply: (
    tenantId: string,
    userId: string,
    input: { title: string; body: string; lineChannelId?: string }
  ) => Promise<unknown>;
};

const createStage3BService = (prisma: MockPrisma): Stage3BInboxService =>
  createService(prisma) as Stage3BInboxService;

describe("InboxService", () => {
  it("lists active conversations inside the current tenant ordered by newest activity", async () => {
    const prisma = createPrisma();
    prisma.conversation.findMany.mockResolvedValue([
      {
        id: "conversation-1",
        tenantId: "tenant-1",
        displayName: "Customer A",
        _count: { messages: 1 }
      }
    ]);

    await expect(createService(prisma).listConversations("tenant-1", { limit: 10, offset: 20 })).resolves.toEqual([
      {
        id: "conversation-1",
        tenantId: "tenant-1",
        displayName: "Customer A",
        unreadInboundMessageCount: 1
      }
    ]);

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
        },
        _count: {
          select: {
            messages: {
              where: {
                direction: MessageDirection.INBOUND,
                markAsReadToken: { not: null },
                deletedAt: null
              }
            }
          }
        },
        tagLinks: {
          where: { deletedAt: null },
          include: {
            tag: true
          }
        }
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      skip: 20,
      take: 10
    });
  });

  it("marks the latest unread LINE message as read and clears unread tokens", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1",
      externalThreadId: "U123",
      lineChannel: {
        id: "line-channel-1",
        isActive: true,
        encryptedChannelAccessToken: "line-token"
      }
    });
    prisma.message.findFirst.mockResolvedValue({
      id: "message-1",
      markAsReadToken: "read-token"
    });
    prisma.message.updateMany.mockResolvedValue({ count: 2 });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => ""
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await createService(prisma).markAsRead("tenant-1", "user-1", "conversation-1");

    expect(fetchMock).toHaveBeenCalledWith("https://api.line.me/v2/bot/chat/markAsRead", {
      method: "POST",
      headers: {
        Authorization: "Bearer line-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        markAsReadToken: "read-token"
      })
    });
    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        conversationId: "conversation-1",
        markAsReadToken: { not: null }
      },
      data: {
        markAsReadToken: null
      }
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

  it("assigns a tenant conversation to a member in the same tenant", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1",
      assignedToMemberId: null
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({
      id: "member-1",
      tenantId: "tenant-1",
      userId: "agent-1"
    });
    prisma.conversation.update.mockResolvedValue({
      id: "conversation-1",
      assignedToMemberId: "member-1"
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await createStage3BService(prisma).assignConversation(
      "tenant-1",
      "user-1",
      "conversation-1",
      "member-1"
    );

    expect(prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: {
        id: "member-1",
        tenantId: "tenant-1",
        isActive: true
      }
    });
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conversation-1" },
      data: { assignedToMemberId: "member-1" }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.CONVERSATION_ASSIGNED,
        targetType: "Conversation",
        targetId: "conversation-1",
        metadata: {
          previousAssignedToMemberId: null,
          assignedToMemberId: "member-1"
        }
      })
    });
  });

  it("rejects assignment to a member from another tenant", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1",
      assignedToMemberId: null
    });
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(
      createStage3BService(prisma).assignConversation(
        "tenant-1",
        "user-1",
        "conversation-1",
        "member-other"
      )
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  it("updates priority and writes an audit log", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1",
      priority: ConversationPriority.NORMAL
    });
    prisma.conversation.update.mockResolvedValue({
      id: "conversation-1",
      priority: ConversationPriority.URGENT
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await createStage3BService(prisma).updatePriority(
      "tenant-1",
      "user-1",
      "conversation-1",
      ConversationPriority.URGENT
    );

    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conversation-1" },
      data: { priority: ConversationPriority.URGENT }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AuditAction.CONVERSATION_PRIORITY_CHANGED,
        metadata: {
          previousPriority: ConversationPriority.NORMAL,
          priority: ConversationPriority.URGENT
        }
      })
    });
  });

  it("adds and removes tenant tags from a conversation", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({ id: "conversation-1", tenantId: "tenant-1" });
    prisma.conversationTag.create.mockResolvedValue({
      id: "tag-1",
      tenantId: "tenant-1",
      name: "VIP",
      color: "#f59e0b"
    });
    prisma.conversationTag.findFirst.mockResolvedValue({
      id: "tag-1",
      tenantId: "tenant-1",
      name: "VIP"
    });
    prisma.conversationTagLink.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "tag-link-1",
        deletedAt: null
      });
    prisma.conversationTagLink.create.mockResolvedValue({ id: "tag-link-1" });
    prisma.conversationTagLink.update.mockResolvedValue({
      id: "tag-link-1",
      deletedAt: new Date("2026-06-14T01:00:00.000Z")
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await createStage3BService(prisma).createTag("tenant-1", "user-1", {
      name: " VIP ",
      color: "#f59e0b"
    });
    await createStage3BService(prisma).addConversationTag(
      "tenant-1",
      "user-1",
      "conversation-1",
      "tag-1"
    );
    await createStage3BService(prisma).removeConversationTag(
      "tenant-1",
      "user-1",
      "conversation-1",
      "tag-1"
    );

    expect(prisma.conversationTag.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        name: "VIP",
        color: "#f59e0b"
      }
    });
    expect(prisma.conversationTagLink.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        conversationId: "conversation-1",
        tagId: "tag-1"
      }
    });
    expect(prisma.conversationTagLink.update).toHaveBeenCalledWith({
      where: { id: "tag-link-1" },
      data: { deletedAt: expect.any(Date) }
    });
  });

  it("creates an internal note without creating a LINE message", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({ id: "conversation-1", tenantId: "tenant-1" });
    prisma.workspaceMember.findFirst.mockResolvedValue({
      id: "member-1",
      tenantId: "tenant-1",
      userId: "user-1"
    });
    prisma.conversationInternalNote.create.mockResolvedValue({
      id: "note-1",
      body: "Call customer tomorrow"
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await createStage3BService(prisma).createNote(
      "tenant-1",
      "user-1",
      "conversation-1",
      " Call customer tomorrow "
    );

    expect(prisma.conversationInternalNote.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        conversationId: "conversation-1",
        authorMemberId: "member-1",
        body: "Call customer tomorrow"
      }
    });
    expect(prisma.message.findMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: AuditAction.CONVERSATION_NOTE_CREATED,
        targetType: "Conversation",
        targetId: "conversation-1"
      })
    });
  });

  it("rejects agent deleting another member internal note", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({ id: "conversation-1", tenantId: "tenant-1" });
    prisma.workspaceMember.findFirst.mockResolvedValue({
      id: "member-1",
      tenantId: "tenant-1",
      userId: "user-1"
    });
    prisma.conversationInternalNote.findFirst.mockResolvedValue({
      id: "note-1",
      tenantId: "tenant-1",
      conversationId: "conversation-1",
      authorMemberId: "member-2"
    });

    await expect(
      createStage3BService(prisma).deleteNote(
        "tenant-1",
        "user-1",
        Role.AGENT,
        "conversation-1",
        "note-1"
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.conversationInternalNote.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("lists saved replies for the current tenant only", async () => {
    const prisma = createPrisma();
    prisma.savedReply.findMany.mockResolvedValue([
      {
        id: "reply-1",
        tenantId: "tenant-1",
        title: "Greeting",
        body: "Hello"
      }
    ]);

    await createStage3BService(prisma).listSavedReplies("tenant-1");

    expect(prisma.savedReply.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        deletedAt: null,
        isActive: true
      },
      orderBy: [{ title: "asc" }, { createdAt: "desc" }]
    });
  });

  it("lists saved replies for one LINE OA only when lineChannelId is provided", async () => {
    const prisma = createPrisma();
    prisma.savedReply.findMany.mockResolvedValue([
      {
        id: "reply-1",
        tenantId: "tenant-1",
        lineChannelId: "line-channel-1",
        title: "Greeting",
        body: "Hello"
      }
    ]);

    await createStage3BService(prisma).listSavedReplies("tenant-1", {
      lineChannelId: "line-channel-1"
    });

    expect(prisma.savedReply.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        lineChannelId: "line-channel-1",
        deletedAt: null,
        isActive: true
      },
      orderBy: [{ title: "asc" }, { createdAt: "desc" }]
    });
  });

  it("creates saved replies scoped to a tenant LINE OA", async () => {
    const prisma = createPrisma();
    prisma.lineChannel.findFirst.mockResolvedValue({
      id: "line-channel-1",
      tenantId: "tenant-1"
    });
    prisma.savedReply.create.mockResolvedValue({
      id: "reply-1",
      tenantId: "tenant-1",
      lineChannelId: "line-channel-1",
      title: "Greeting",
      body: "Hello"
    });

    await createStage3BService(prisma).createSavedReply("tenant-1", "user-1", {
      lineChannelId: "line-channel-1",
      title: " Greeting ",
      body: " Hello "
    });

    expect(prisma.lineChannel.findFirst).toHaveBeenCalledWith({
      where: {
        id: "line-channel-1",
        tenantId: "tenant-1",
        deletedAt: null,
        isActive: true
      }
    });
    expect(prisma.savedReply.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        lineChannelId: "line-channel-1",
        title: "Greeting",
        body: "Hello",
        userId: null,
        shortcutKey: null,
        imageUrl: null,
        hotkeyBinding: null
      }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.SAVED_REPLY_CREATED,
        metadata: expect.objectContaining({
          lineChannelId: "line-channel-1",
          title: "Greeting"
        })
      })
    });
  });
});
