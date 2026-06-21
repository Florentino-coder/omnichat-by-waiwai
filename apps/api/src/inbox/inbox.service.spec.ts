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
import { AiSuggestionStatus } from "./dto/update-ai-suggestion.dto";

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
  customer: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
  };
  aiSuggestion: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
    updateMany: jest.Mock<Promise<unknown>, [unknown]>;
  };
  promptTemplate: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
  };
  tenant: {
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
  };
  planLimit: {
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
  };
  usageCounter: {
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
    upsert: jest.Mock<Promise<unknown>, [unknown]>;
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
  },
  customer: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>()
  },
  aiSuggestion: {
    create: jest.fn<Promise<unknown>, [unknown]>(),
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>(),
    updateMany: jest.fn<Promise<unknown>, [unknown]>()
  },
  promptTemplate: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>()
  },
  tenant: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>()
  },
  planLimit: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>()
  },
  usageCounter: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    upsert: jest.fn<Promise<unknown>, [unknown]>()
  }
});

import { CryptoSecretService } from "../auth/crypto-secret.service";

const mockCryptoSecretService = {
  decrypt: jest.fn().mockImplementation((val) => val),
  encrypt: jest.fn().mockImplementation((val) => val)
} as unknown as CryptoSecretService;

const mockRedisService = {
  client: {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(true)
  }
};

const mockLlmClient = {
  generateReply: jest.fn().mockResolvedValue("AI Suggested Answer")
};

function mockAiCreditsAvailable(prisma: MockPrisma): void {
  prisma.tenant.findUnique.mockResolvedValue({ planId: "pro" });
  prisma.planLimit.findUnique.mockResolvedValue({ maxAiCreditsPerMonth: 10000 });
  prisma.usageCounter.findUnique.mockResolvedValue(null);
  prisma.usageCounter.upsert.mockResolvedValue({ value: 1n });
}

const mockKnowledgeService = {
  buildKnowledgeContext: jest.fn().mockResolvedValue("ไม่มี"),
  buildKnowledgeContextWithCitations: jest.fn().mockResolvedValue({
    context: "ไม่มี",
    citations: []
  })
};

const mockScenarioService = {
  buildScenarioInstructions: jest.fn().mockResolvedValue({
    scenario: null,
    instructions: "ไม่มี scenario ที่ match — ตอบตาม knowledge และบริบททั่วไป"
  }),
  applyScenarioActions: jest.fn().mockResolvedValue(undefined)
};

const mockAutomationService = {
  dispatchEvent: jest.fn().mockResolvedValue(undefined)
};

const createService = (prisma: MockPrisma): InboxService =>
  new InboxService(
    prisma as unknown as PrismaService,
    mockCryptoSecretService,
    mockRedisService as any,
    mockLlmClient as any,
    mockLlmClient as any,
    mockLlmClient as any,
    mockKnowledgeService as any,
    mockScenarioService as any,
    mockAutomationService as any
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
        unreadInboundMessageCount: 1,
        customerDisplayName: null
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
        },
        customer: {
          select: {
            displayName: true
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
    prisma.tenantSettings.findUnique.mockResolvedValue({
      inProgressAlertMinutes: 15,
      enableAiSuggest: true,
      aiProvider: "gemini",
      aiAgentGender: "FEMALE"
    });
    prisma.tenantSettings.upsert.mockResolvedValue({
      inProgressAlertMinutes: 5,
      enableAiSuggest: true,
      aiProvider: "gemini",
      aiAgentGender: "FEMALE"
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await expect(createService(prisma).getSettings("tenant-1")).resolves.toEqual({
      inProgressAlertMinutes: 15,
      enableAiSuggest: true,
      aiProvider: "gemini",
      aiAgentGender: "FEMALE"
    });
    await createService(prisma).updateSettings("tenant-1", "user-1", { inProgressAlertMinutes: 5 });

    expect(prisma.tenantSettings.upsert).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
      create: {
        tenantId: "tenant-1",
        inProgressAlertMinutes: 5,
        enableAiSuggest: true,
        aiProvider: "gemini",
        aiAgentGender: "FEMALE"
      },
      update: {
        inProgressAlertMinutes: 5,
        enableAiSuggest: undefined,
        aiProvider: undefined,
        aiAgentGender: undefined
      },
      select: {
        inProgressAlertMinutes: true,
        enableAiSuggest: true,
        aiProvider: true,
        aiAgentGender: true
      }
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

  describe("AI Suggest Reply", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockRedisService.client.incr.mockResolvedValue(1);
      mockLlmClient.generateReply.mockResolvedValue("AI Suggested Answer");
      mockKnowledgeService.buildKnowledgeContextWithCitations.mockResolvedValue({
        context: "ไม่มี",
        citations: []
      });
    });

    function setupAiSuggestPrisma(prisma: MockPrisma): void {
      mockAiCreditsAvailable(prisma);
      prisma.tenantSettings.findUnique.mockResolvedValue({
        enableAiSuggest: true,
        aiProvider: "gemini",
        aiAgentGender: "FEMALE"
      });
      prisma.auditLog.create.mockResolvedValue({ id: "audit-ai" });
    }

    it("should throw forbidden when AI suggestions are disabled for tenant", async () => {
      const prisma = createPrisma();
      prisma.tenantSettings.findUnique.mockResolvedValue({
        tenantId: "tenant-1",
        enableAiSuggest: false
      });
      const service = createService(prisma);
      await expect(service.aiSuggest("tenant-1", "user-1", "conv-1", { action_type: "generate" as any })).rejects.toThrow(
        expect.objectContaining({
          status: 403
        })
      );
      expect(mockLlmClient.generateReply).not.toHaveBeenCalled();
    });

    it("should throw rate limit exception when conversation rate limit is exceeded", async () => {
      const prisma = createPrisma();
      mockRedisService.client.incr.mockResolvedValueOnce(11).mockResolvedValueOnce(1);
      const service = createService(prisma);
      await expect(service.aiSuggest("tenant-1", "user-1", "conv-1", { action_type: "generate" as any })).rejects.toThrow(
        expect.objectContaining({
          status: 429
        })
      );
    });

    it("should throw rate limit exception when tenant rate limit is exceeded", async () => {
      const prisma = createPrisma();
      mockRedisService.client.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(61);
      const service = createService(prisma);
      await expect(service.aiSuggest("tenant-1", "user-1", "conv-1", { action_type: "generate" as any })).rejects.toThrow(
        expect.objectContaining({
          status: 429
        })
      );
    });

    it("should compile context, prompt template fallback, call LLM, and log suggestion on success", async () => {
      const prisma = createPrisma();
      setupAiSuggestPrisma(prisma);
      
      // Mock conversation findFirst
      prisma.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        tenantId: "tenant-1",
        customerId: "cust-1",
        customer: {
          id: "cust-1",
          displayName: "Somsak",
          deletedAt: null
        }
      });

      // Mock recent messages
      prisma.message.findMany.mockResolvedValue([
        {
          id: "msg-1",
          direction: "INBOUND",
          text: "สวัสดีครับ",
          createdAt: new Date()
        }
      ]);

      // Mock all conversations for this customer (tags and notes)
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: "conv-1",
          tagLinks: [
            {
              tag: {
                name: "Allergy Shrimp",
                deletedAt: null
              }
            }
          ],
          internalNotes: [
            {
              body: "แพ้กุ้ง ห้ามแนะนำเมนูกุ้ง",
              createdAt: new Date(),
              deletedAt: null
            }
          ]
        }
      ]);

      // Mock PromptTemplate findFirst (none for tenant, fallbacks to global)
      prisma.promptTemplate.findFirst
        .mockResolvedValueOnce(null) // tenant template not found
        .mockResolvedValueOnce({
          id: "global-temp",
          tenantId: null,
          name: "suggested_reply_default",
          systemPrompt: "Name: {{customer_name}}, Tags: {{tags}}, Notes: {{notes}}, History: {{conversation_history}}"
        });

      // Mock AiSuggestion creation
      prisma.aiSuggestion.create.mockResolvedValue({
        id: "sug-1",
        suggestionText: "AI Suggested Answer"
      });

      const service = createService(prisma);
      const result = await service.aiSuggest("tenant-1", "user-1", "conv-1", { action_type: "generate" as any });

      expect(result).toEqual({
        mode: "llm",
        suggestion_id: "sug-1",
        suggestion_text: "AI Suggested Answer",
        knowledge_citations: []
      });

      expect(mockLlmClient.generateReply).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining("Name: Somsak"),
          conversationHistory: [{ role: "customer", text: "สวัสดีครับ" }]
        })
      );

      expect(prisma.aiSuggestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          conversationId: "conv-1",
          suggestionText: "AI Suggested Answer",
          status: "shown"
        })
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.AI_SUGGEST_GENERATED,
          targetId: "sug-1"
        })
      });

      expect(prisma.usageCounter.upsert).toHaveBeenCalled();
    });

    it("should normalize dual Thai polite particles for female agent gender", async () => {
      const prisma = createPrisma();
      setupAiSuggestPrisma(prisma);

      prisma.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        tenantId: "tenant-1",
        customerId: "cust-1",
        customer: { id: "cust-1", displayName: "F", deletedAt: null }
      });
      prisma.message.findMany.mockResolvedValue([
        { id: "msg-1", direction: "INBOUND", text: "สบายดีไหม", createdAt: new Date() }
      ]);
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.promptTemplate.findFirst.mockResolvedValue({
        systemPrompt: "{{agent_gender_instruction}} {{conversation_history}}"
      });
      prisma.aiSuggestion.create.mockResolvedValue({
        id: "sug-dual",
        suggestionText: "normalized"
      });

      mockLlmClient.generateReply.mockResolvedValueOnce(
        "สบายดีค่ะ/ครับ ขอบคุณที่ถามนะคะ/นะครับ"
      );

      const service = createService(prisma);
      const result = await service.aiSuggest("tenant-1", "user-1", "conv-1", {
        action_type: "generate" as any
      });

      expect(result.suggestion_text).toBe("สบายดีค่ะ ขอบคุณที่ถามนะคะ");
    });

    it("should throw plan limit exception when monthly AI credits are exhausted", async () => {
      const prisma = createPrisma();
      setupAiSuggestPrisma(prisma);
      prisma.planLimit.findUnique.mockResolvedValue({ maxAiCreditsPerMonth: 100 });
      prisma.usageCounter.findUnique.mockResolvedValue({ value: 100n });

      const service = createService(prisma);
      await expect(
        service.aiSuggest("tenant-1", "user-1", "conv-1", { action_type: "generate" as any })
      ).rejects.toThrow(ForbiddenException);

      expect(mockLlmClient.generateReply).not.toHaveBeenCalled();
    });

    it("should ignore soft-deleted customer notes and details in prompt creation", async () => {
      const prisma = createPrisma();
      setupAiSuggestPrisma(prisma);
      
      prisma.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        tenantId: "tenant-1",
        customerId: "cust-1",
        customer: {
          id: "cust-1",
          displayName: "Somsak",
          deletedAt: new Date() // Soft deleted!
        }
      });

      const service = createService(prisma);
      await expect(service.aiSuggest("tenant-1", "user-1", "conv-1", { action_type: "generate" as any })).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw 502 Bad Gateway and not write suggestion to DB on LLM error", async () => {
      const prisma = createPrisma();
      setupAiSuggestPrisma(prisma);
      
      prisma.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        tenantId: "tenant-1",
        customerId: "cust-1",
        customer: {
          id: "cust-1",
          displayName: "Somsak",
          deletedAt: null
        }
      });

      prisma.message.findMany.mockResolvedValue([]);
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.promptTemplate.findFirst.mockResolvedValue({
        systemPrompt: "Default Prompt"
      });

      mockLlmClient.generateReply.mockRejectedValue(new Error("Timeout/API Error"));

      const service = createService(prisma);
      await expect(service.aiSuggest("tenant-1", "user-1", "conv-1", { action_type: "generate" as any })).rejects.toThrow(
        expect.objectContaining({
          status: 504
        })
      );

      expect(prisma.aiSuggestion.create).not.toHaveBeenCalled();
    });

    it("should return knowledge_only fallback when LLM is rate limited and citations exist", async () => {
      const prisma = createPrisma();
      setupAiSuggestPrisma(prisma);

      prisma.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        tenantId: "tenant-1",
        customerId: "cust-1",
        customer: {
          id: "cust-1",
          displayName: "Somsak",
          deletedAt: null
        }
      });
      prisma.message.findMany.mockResolvedValue([]);
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.promptTemplate.findFirst.mockResolvedValue({
        systemPrompt: "Default Prompt"
      });

      mockKnowledgeService.buildKnowledgeContextWithCitations.mockResolvedValueOnce({
        context: "Shipping policy context",
        citations: [
          {
            type: "document",
            title: "Shipping FAQ",
            score: 0.91,
            excerpt: "Free shipping over 500 THB"
          }
        ]
      });

      mockLlmClient.generateReply.mockRejectedValue(new Error("Gemini API status 429: quota exceeded"));

      const service = createService(prisma);
      const result = await service.aiSuggest("tenant-1", "user-1", "conv-1", {
        action_type: "generate" as any
      });

      expect(result).toEqual({
        mode: "knowledge_only",
        suggestion_id: null,
        suggestion_text: null,
        knowledge_citations: [
          {
            type: "document",
            title: "Shipping FAQ",
            score: 0.91,
            excerpt: "Free shipping over 500 THB"
          }
        ]
      });

      expect(prisma.aiSuggestion.create).not.toHaveBeenCalled();
      expect(prisma.usageCounter.upsert).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.AI_SUGGEST_FAILED,
          metadata: expect.objectContaining({
            mode: "knowledge_only",
            errorCode: "AI_PROVIDER_RATE_LIMITED"
          })
        })
      });
    });

    it("should update status and final sent text of a suggestion", async () => {
      const prisma = createPrisma();
      
      prisma.aiSuggestion.findFirst.mockResolvedValue({
        id: "sug-1",
        tenantId: "tenant-1",
        conversationId: "conv-1",
        status: AiSuggestionStatus.SHOWN
      });
      prisma.aiSuggestion.update.mockResolvedValue({
        id: "sug-1",
        status: AiSuggestionStatus.SENT
      });
      prisma.auditLog.create.mockResolvedValue({ id: "audit-ai-sent" });

      const service = createService(prisma);
      const result = await service.updateAiSuggestion("tenant-1", "user-1", "sug-1", {
        status: AiSuggestionStatus.SENT,
        final_sent_text: "Final Answer"
      });

      expect(result).toEqual({
        success: true,
        id: "sug-1",
        status: AiSuggestionStatus.SENT
      });

      expect(prisma.aiSuggestion.update).toHaveBeenCalledWith({
        where: { id: "sug-1" },
        data: {
          status: AiSuggestionStatus.SENT,
          finalSentText: "Final Answer"
        }
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.AI_SUGGEST_SENT
        })
      });
    });

    it("should throw NotFoundException on update if suggestion does not match tenant", async () => {
      const prisma = createPrisma();
      prisma.aiSuggestion.findFirst.mockResolvedValue(null);

      const service = createService(prisma);
      await expect(
        service.updateAiSuggestion("tenant-1", "user-1", "sug-1", { status: AiSuggestionStatus.SENT })
      ).rejects.toThrow(NotFoundException);
    });

    it("should mark previous suggestion as superseded when refinement is requested", async () => {
      const prisma = createPrisma();
      setupAiSuggestPrisma(prisma);
      
      prisma.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        tenantId: "tenant-1",
        customerId: "cust-1",
        customer: {
          id: "cust-1",
          displayName: "Somsak",
          deletedAt: null
        }
      });
      prisma.message.findMany.mockResolvedValue([]);
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.promptTemplate.findFirst.mockResolvedValue({
        systemPrompt: "Default Prompt {{current_draft}}"
      });
      prisma.aiSuggestion.create.mockResolvedValue({
        id: "sug-2",
        suggestionText: "Shorter answer"
      });
      mockLlmClient.generateReply.mockResolvedValueOnce("Shorter answer");

      const service = createService(prisma);
      const result = await service.aiSuggest("tenant-1", "user-1", "conv-1", {
        action_type: "shorter" as any,
        current_text: "Old long text draft",
        previous_suggestion_id: "sug-1"
      });

      expect(result).toEqual({
        mode: "llm",
        suggestion_id: "sug-2",
        suggestion_text: "Shorter answer",
        knowledge_citations: []
      });

      expect(prisma.aiSuggestion.updateMany).toHaveBeenCalledWith({
        where: {
          id: "sug-1",
          tenantId: "tenant-1"
        },
        data: {
          status: "superseded"
        }
      });
    });
  });

  describe("AI Usage & Test", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockRedisService.client.incr.mockResolvedValue(1);
      mockLlmClient.generateReply.mockResolvedValue("สวัสดีค่ะ ยินดีให้บริการนะคะ");
    });

    it("should return AI usage snapshot for tenant", async () => {
      const prisma = createPrisma();
      prisma.tenant.findUnique.mockResolvedValue({ planId: "pro" });
      prisma.planLimit.findUnique.mockResolvedValue({ maxAiCreditsPerMonth: 500 });
      prisma.usageCounter.findUnique.mockResolvedValue({ value: 120n });
      prisma.tenantSettings.findUnique.mockResolvedValue({ aiProvider: "gemini" });

      const service = createService(prisma);
      const result = await service.getAiUsage("tenant-1");

      expect(result.used).toBe(120);
      expect(result.limit).toBe(500);
      expect(result.remaining).toBe(380);
      expect(result.percentage).toBe(24);
      expect(result.provider).toBe("gemini");
      expect(result.providerLabel).toBe("Google Gemini");
      expect(result.creditsAvailable).toBe(true);
      expect(result.blockReason).toBeNull();
      expect(result.periodStart).toEqual(expect.any(String));
      expect(result.periodEnd).toEqual(expect.any(String));
    });

    it("should mark plan without AI credits as PLAN_EXCLUDES_AI", async () => {
      const prisma = createPrisma();
      prisma.tenant.findUnique.mockResolvedValue({ planId: "free" });
      prisma.planLimit.findUnique.mockResolvedValue({ maxAiCreditsPerMonth: 0 });
      prisma.usageCounter.findUnique.mockResolvedValue({ value: 0n });
      prisma.tenantSettings.findUnique.mockResolvedValue({ aiProvider: "gemini" });

      const service = createService(prisma);
      const result = await service.getAiUsage("tenant-1");

      expect(result.creditsAvailable).toBe(false);
      expect(result.blockReason).toBe("PLAN_EXCLUDES_AI");
    });

    it("should mark exhausted monthly quota as MONTHLY_LIMIT_REACHED", async () => {
      const prisma = createPrisma();
      prisma.tenant.findUnique.mockResolvedValue({ planId: "starter" });
      prisma.planLimit.findUnique.mockResolvedValue({ maxAiCreditsPerMonth: 100 });
      prisma.usageCounter.findUnique.mockResolvedValue({ value: 100n });
      prisma.tenantSettings.findUnique.mockResolvedValue({ aiProvider: "gemini" });

      const service = createService(prisma);
      const result = await service.getAiUsage("tenant-1");

      expect(result.creditsAvailable).toBe(false);
      expect(result.blockReason).toBe("MONTHLY_LIMIT_REACHED");
      expect(result.remaining).toBe(0);
    });

    it("should run AI test with sample message and consume credit", async () => {
      const prisma = createPrisma();
      mockAiCreditsAvailable(prisma);
      prisma.tenantSettings.findUnique.mockResolvedValue({
        enableAiSuggest: true,
        aiProvider: "gemini",
        aiAgentGender: "FEMALE"
      });
      prisma.promptTemplate.findFirst.mockResolvedValue({
        systemPrompt: "{{agent_gender_instruction}} {{conversation_history}}"
      });
      prisma.auditLog.create.mockResolvedValue({ id: "audit-test" });

      const service = createService(prisma);
      const result = await service.aiTest("tenant-1", "user-1", {
        sample_message: "มีโปรโมชั่นอะไรบ้างคะ"
      });

      expect(result.suggestion_text).toBe("สวัสดีค่ะ ยินดีให้บริการนะคะ");
      expect(result.provider).toBe("gemini");
      expect(result.provider_label).toBe("Google Gemini");
      expect(result.latency_ms).toEqual(expect.any(Number));
      expect(mockLlmClient.generateReply).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationHistory: [{ role: "customer", text: "มีโปรโมชั่นอะไรบ้างคะ" }]
        })
      );
      expect(prisma.usageCounter.upsert).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.AI_SUGGEST_GENERATED,
          metadata: expect.objectContaining({ mode: "test" })
        })
      });
    });

    it("should throw rate limit when AI test exceeds tenant limit", async () => {
      const prisma = createPrisma();
      mockRedisService.client.incr.mockResolvedValue(11);

      const service = createService(prisma);
      await expect(
        service.aiTest("tenant-1", "user-1", { sample_message: "ทดสอบ" })
      ).rejects.toThrow(
        expect.objectContaining({
          status: 429
        })
      );
      expect(mockLlmClient.generateReply).not.toHaveBeenCalled();
    });

    it("should throw forbidden when AI test is run while suggestions are disabled", async () => {
      const prisma = createPrisma();
      prisma.tenantSettings.findUnique.mockResolvedValue({
        enableAiSuggest: false
      });

      const service = createService(prisma);
      await expect(service.aiTest("tenant-1", "user-1", {})).rejects.toThrow(
        expect.objectContaining({
          status: 403
        })
      );
    });
  });
});
