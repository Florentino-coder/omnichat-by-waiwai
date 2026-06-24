import { AuditAction, MessageDirection, MessageSource, MessageType } from "@prisma/client";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { LineReplyService } from "./line-reply.service";
import { AiPolicyService } from "../ai/ai-policy.service";

type MockPrisma = {
  conversation: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
  lineChannel: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
  };
  message: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
  };
  aiSuggestion: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    updateMany: jest.Mock<Promise<unknown>, [unknown]>;
  };
  aiTrainingPair: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
  auditLog: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
  tenantSettings: {
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

const createPrisma = (): MockPrisma => ({
  conversation: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>()
  },
  lineChannel: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>()
  },
  message: {
    create: jest.fn<Promise<unknown>, [unknown]>(),
    findFirst: jest.fn<Promise<unknown>, [unknown]>()
  },
  aiSuggestion: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    updateMany: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({ count: 0 })
  },
  aiTrainingPair: {
    create: jest.fn<Promise<unknown>, [unknown]>()
  },
  auditLog: {
    create: jest.fn<Promise<unknown>, [unknown]>()
  },
  tenantSettings: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({
      aiPolicyBlockedTopics: []
    })
  }
});

const createPolicyService = (): AiPolicyService =>
  ({
    checkReply: jest.fn().mockReturnValue({ allowed: true, matchedTopics: [] })
  }) as unknown as AiPolicyService;

function createService(
  prisma: MockPrisma,
  crypto: CryptoSecretService,
  realtime?: RealtimeService
): LineReplyService {
  return new LineReplyService(
    prisma as unknown as PrismaService,
    crypto,
    createPolicyService(),
    realtime
  );
}

describe("LineReplyService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sends text replies through LINE and stores outbound message", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1",
      lineChannelId: "line-channel-1",
      externalThreadId: "U123"
    });
    prisma.lineChannel.findFirst.mockResolvedValue({
      id: "line-channel-1",
      tenantId: "tenant-1",
      encryptedChannelAccessToken: "encrypted-token"
    });
    prisma.message.create.mockResolvedValue({ id: "message-2" });
    prisma.conversation.update.mockResolvedValue({ id: "conversation-1" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue("")
    }) as unknown as typeof fetch;
    const crypto = {
      decrypt: jest.fn().mockReturnValue("channel-token"),
      encrypt: jest.fn()
    } as unknown as CryptoSecretService;

    await createService(prisma, crypto).replyText(
      "tenant-1",
      "user-1",
      "conversation-1",
      { text: "สวัสดีครับ" }
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/push",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer channel-token"
        })
      })
    );
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        conversationId: "conversation-1",
        lineChannelId: "line-channel-1",
        direction: MessageDirection.OUTBOUND,
        source: MessageSource.LINE,
        type: MessageType.TEXT,
        text: "สวัสดีครับ"
      })
    });
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conversation-1" },
      data: { lastMessageAt: expect.any(Date) }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        action: AuditAction.LINE_REPLY_SENT,
        targetType: "Message",
        targetId: "message-2"
      })
    });
  });

  it("broadcasts outbound replies to tenant SSE streams after storing the message", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1",
      lineChannelId: "line-channel-1",
      externalThreadId: "U123"
    });
    prisma.lineChannel.findFirst.mockResolvedValue({
      id: "line-channel-1",
      tenantId: "tenant-1",
      encryptedChannelAccessToken: "encrypted-token"
    });
    prisma.message.create.mockResolvedValue({ id: "message-2" });
    prisma.conversation.update.mockResolvedValue({ id: "conversation-1" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue("")
    }) as unknown as typeof fetch;
    const crypto = {
      decrypt: jest.fn().mockReturnValue("channel-token"),
      encrypt: jest.fn()
    } as unknown as CryptoSecretService;
    const realtime = {
      publishTenantEvent: jest.fn<Promise<void>, [string, string, unknown]>().mockResolvedValue(undefined)
    };

    await createService(prisma, crypto, realtime as unknown as RealtimeService).replyText(
      "tenant-1",
      "user-1",
      "conversation-1",
      { text: "done" }
    );

    expect(realtime.publishTenantEvent).toHaveBeenCalledWith(
      "tenant-1",
      "message.created",
      expect.objectContaining({
        conversationId: "conversation-1",
        messageId: "message-2",
        direction: MessageDirection.OUTBOUND
      })
    );
  });

  it("sends image replies through LINE when an HTTPS image URL is provided", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1",
      lineChannelId: "line-channel-1",
      externalThreadId: "U123"
    });
    prisma.lineChannel.findFirst.mockResolvedValue({
      id: "line-channel-1",
      tenantId: "tenant-1",
      encryptedChannelAccessToken: "encrypted-token"
    });
    prisma.message.create.mockResolvedValue({ id: "message-image-1" });
    prisma.conversation.update.mockResolvedValue({ id: "conversation-1" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue("")
    }) as unknown as typeof fetch;
    const crypto = {
      decrypt: jest.fn().mockReturnValue("channel-token"),
      encrypt: jest.fn()
    } as unknown as CryptoSecretService;

    await createService(prisma, crypto).replyText(
      "tenant-1",
      "user-1",
      "conversation-1",
      { imageUrl: "https://cdn.example.com/photo.jpg" }
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/push",
      expect.objectContaining({
        body: JSON.stringify({
          to: "U123",
          messages: [
            {
              type: "image",
              originalContentUrl: "https://cdn.example.com/photo.jpg",
              previewImageUrl: "https://cdn.example.com/photo.jpg"
            }
          ]
        })
      })
    );
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        conversationId: "conversation-1",
        lineChannelId: "line-channel-1",
        direction: MessageDirection.OUTBOUND,
        source: MessageSource.LINE,
        type: MessageType.UNKNOWN,
        text: "Image: https://cdn.example.com/photo.jpg"
      })
    });
  });

  it("sets userId to null in audit logs when sent by automation system user", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1",
      lineChannelId: "line-channel-1",
      externalThreadId: "U123"
    });
    prisma.lineChannel.findFirst.mockResolvedValue({
      id: "line-channel-1",
      tenantId: "tenant-1",
      encryptedChannelAccessToken: "encrypted-token"
    });
    prisma.message.create.mockResolvedValue({ id: "message-2" });
    prisma.conversation.update.mockResolvedValue({ id: "conversation-1" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue("")
    }) as unknown as typeof fetch;
    const crypto = {
      decrypt: jest.fn().mockReturnValue("channel-token"),
      encrypt: jest.fn()
    } as unknown as CryptoSecretService;

    await createService(prisma, crypto).replyText(
      "tenant-1",
      "automation",
      "conversation-1",
      { text: "สวัสดีจากระบบออโต้" }
    );

    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rawPayload: { omnichatMeta: { triggeredBy: "automation" } }
      })
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        userId: null,
        action: AuditAction.LINE_REPLY_SENT,
        targetType: "Message",
        targetId: "message-2",
        metadata: expect.objectContaining({
          triggeredBy: "automation"
        })
      })
    });
  });

  it("creates an AiTrainingPair when manual reply is sent and a last customer message exists", async () => {
    const prisma = createPrisma();
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conversation-1",
      tenantId: "tenant-1",
      lineChannelId: "line-channel-1",
      externalThreadId: "U123"
    });
    prisma.lineChannel.findFirst.mockResolvedValue({
      id: "line-channel-1",
      tenantId: "tenant-1",
      encryptedChannelAccessToken: "encrypted-token"
    });
    prisma.message.create.mockResolvedValue({ id: "message-2" });
    prisma.conversation.update.mockResolvedValue({ id: "conversation-1" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue("")
    }) as unknown as typeof fetch;
    const crypto = {
      decrypt: jest.fn().mockReturnValue("channel-token"),
      encrypt: jest.fn()
    } as unknown as CryptoSecretService;

    // Mock last customer message and AI suggestion
    prisma.message.findFirst.mockResolvedValue({
      id: "message-1",
      text: "ขอราคาหน่อยครับ",
      direction: MessageDirection.INBOUND
    });
    prisma.aiSuggestion.findFirst.mockResolvedValue({
      id: "sug-1",
      suggestionText: "ราคา 290 บาทค่ะ"
    });

    await createService(prisma, crypto).replyText(
      "tenant-1",
      "user-1",
      "conversation-1",
      { text: "ราคา 290 บาทครับ", aiSuggestionId: "sug-1" }
    );

    expect(prisma.aiTrainingPair.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        conversationId: "conversation-1",
        customerMessage: "ขอราคาหน่อยครับ",
        assistantReply: "ราคา 290 บาทครับ",
        suggestionId: "sug-1",
        isSuggestionUsed: true,
        isEdited: true,
        status: "pending"
      })
    });
    expect(prisma.aiSuggestion.updateMany).toHaveBeenCalledWith({
      where: {
        conversationId: "conversation-1",
        tenantId: "tenant-1",
        status: "shown"
      },
      data: { status: "superseded" }
    });
  });
});

