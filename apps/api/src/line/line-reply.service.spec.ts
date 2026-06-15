import { AuditAction, MessageDirection, MessageSource, MessageType } from "@prisma/client";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { LineReplyService } from "./line-reply.service";

type MockPrisma = {
  conversation: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
  };
  lineChannel: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
  };
  message: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
  auditLog: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

const createPrisma = (): MockPrisma => ({
  conversation: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>()
  },
  lineChannel: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>()
  },
  message: {
    create: jest.fn<Promise<unknown>, [unknown]>()
  },
  auditLog: {
    create: jest.fn<Promise<unknown>, [unknown]>()
  }
});

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

    await new LineReplyService(prisma as unknown as PrismaService, crypto).replyText(
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

    await new LineReplyService(
      prisma as unknown as PrismaService,
      crypto,
      realtime as unknown as RealtimeService
    ).replyText("tenant-1", "user-1", "conversation-1", { text: "done" });

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

    await new LineReplyService(prisma as unknown as PrismaService, crypto).replyText(
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
});
