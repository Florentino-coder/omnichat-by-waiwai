import { AuditAction, MessageDirection, MessageSource, MessageType } from "@prisma/client";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PrismaService } from "../prisma/prisma.service";
import { LineWebhookService } from "./line-webhook.service";

type MockPrisma = {
  lineChannel: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
  conversation: {
    upsert: jest.Mock<Promise<unknown>, [unknown]>;
  };
  message: {
    upsert: jest.Mock<Promise<unknown>, [unknown]>;
  };
  auditLog: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

const createPrisma = (): MockPrisma => ({
  lineChannel: {
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>()
  },
  conversation: {
    upsert: jest.fn<Promise<unknown>, [unknown]>()
  },
  message: {
    upsert: jest.fn<Promise<unknown>, [unknown]>()
  },
  auditLog: {
    create: jest.fn<Promise<unknown>, [unknown]>()
  }
});

describe("LineWebhookService", () => {
  it("stores inbound LINE text messages inside tenant scope", async () => {
    const prisma = createPrisma();
    prisma.lineChannel.findFirst.mockResolvedValue({
      id: "line-channel-1",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      encryptedChannelSecret: "encrypted-secret",
      encryptedChannelAccessToken: "encrypted-token"
    });
    prisma.conversation.upsert.mockResolvedValue({ id: "conversation-1" });
    prisma.message.upsert.mockResolvedValue({ id: "message-1" });
    prisma.lineChannel.update.mockResolvedValue({ id: "line-channel-1" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    const crypto = {
      decrypt: jest.fn().mockReturnValue("channel-secret"),
      encrypt: jest.fn()
    } as unknown as CryptoSecretService;

    await new LineWebhookService(prisma as unknown as PrismaService, crypto).process(
      "line-channel-1",
      {
        events: [
          {
            type: "message",
            source: { type: "user", userId: "U123" },
            message: { id: "msg-1", type: "text", text: "hello" },
            timestamp: 1700000000000
          }
        ]
      }
    );

    expect(prisma.conversation.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_source_lineChannelId_externalThreadId: {
          tenantId: "tenant-1",
          source: MessageSource.LINE,
          lineChannelId: "line-channel-1",
          externalThreadId: "U123"
        }
      },
      create: expect.objectContaining({
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        lineChannelId: "line-channel-1",
        source: MessageSource.LINE,
        externalThreadId: "U123"
      }),
      update: expect.objectContaining({
        lastMessageAt: expect.any(Date)
      })
    });
    expect(prisma.message.upsert).toHaveBeenCalledWith({
      where: {
        lineChannelId_externalMessageId: {
          lineChannelId: "line-channel-1",
          externalMessageId: "msg-1"
        }
      },
      create: expect.objectContaining({
        tenantId: "tenant-1",
        conversationId: "conversation-1",
        lineChannelId: "line-channel-1",
        direction: MessageDirection.INBOUND,
        source: MessageSource.LINE,
        type: MessageType.TEXT,
        externalMessageId: "msg-1",
        text: "hello"
      }),
      update: expect.objectContaining({
        rawPayload: expect.objectContaining({ type: "message" })
      })
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        action: AuditAction.LINE_MESSAGE_RECEIVED,
        targetType: "Message",
        targetId: "message-1"
      })
    });
  });

  it("uses the LINE profile API to name customer conversations", async () => {
    const fetchMock = jest.fn<Promise<unknown>, [string, unknown]>().mockResolvedValue({
      ok: true,
      json: async () => ({
        displayName: "Somchai LINE",
        pictureUrl: "https://profile.line-scdn.net/customer.png",
        statusMessage: "Ready",
        language: "th"
      })
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });
    const prisma = createPrisma();
    prisma.lineChannel.findFirst.mockResolvedValue({
      id: "line-channel-1",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      encryptedChannelSecret: "encrypted-secret",
      encryptedChannelAccessToken: "encrypted-token"
    });
    prisma.conversation.upsert.mockResolvedValue({ id: "conversation-1" });
    prisma.message.upsert.mockResolvedValue({ id: "message-1" });
    prisma.lineChannel.update.mockResolvedValue({ id: "line-channel-1" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    const crypto = {
      decrypt: jest.fn((value: string) =>
        value === "encrypted-token" ? "channel-token" : "channel-secret"
      ),
      encrypt: jest.fn()
    } as unknown as CryptoSecretService;

    await new LineWebhookService(prisma as unknown as PrismaService, crypto).process(
      "line-channel-1",
      {
        events: [
          {
            type: "message",
            source: { type: "user", userId: "U123" },
            message: { id: "msg-1", type: "text", text: "hello" },
            timestamp: 1700000000000
          }
        ]
      }
    );

    expect(fetchMock).toHaveBeenCalledWith("https://api.line.me/v2/bot/profile/U123", {
      headers: { Authorization: "Bearer channel-token" }
    });
    expect(prisma.conversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          displayName: "Somchai LINE"
        }),
        update: expect.objectContaining({
          displayName: "Somchai LINE"
        })
      })
    );
    expect(prisma.message.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          rawPayload: expect.objectContaining({
            lineProfile: expect.objectContaining({
              displayName: "Somchai LINE",
              language: "th"
            })
          })
        })
      })
    );
  });

  it("stores inbound LINE sticker messages so non-text chats still appear", async () => {
    const prisma = createPrisma();
    prisma.lineChannel.findFirst.mockResolvedValue({
      id: "line-channel-2",
      tenantId: "tenant-1",
      workspaceId: "workspace-1",
      encryptedChannelSecret: "encrypted-secret",
      encryptedChannelAccessToken: "encrypted-token"
    });
    prisma.conversation.upsert.mockResolvedValue({ id: "conversation-2" });
    prisma.message.upsert.mockResolvedValue({ id: "message-2" });
    prisma.lineChannel.update.mockResolvedValue({ id: "line-channel-2" });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-2" });
    const crypto = {
      decrypt: jest.fn().mockReturnValue("channel-token"),
      encrypt: jest.fn()
    } as unknown as CryptoSecretService;

    const payload = {
        events: [
          {
            type: "message",
            source: { type: "user", userId: "U123" },
            message: {
              id: "sticker-msg-1",
              type: "sticker",
              packageId: "11538",
              stickerId: "51626494",
              stickerResourceType: "STATIC"
            },
            timestamp: 1700000000000
          }
        ]
      };

    await new LineWebhookService(prisma as unknown as PrismaService, crypto).process(
      "1656471223",
      payload as Parameters<LineWebhookService["process"]>[1]
    );

    expect(prisma.conversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_source_lineChannelId_externalThreadId: {
            tenantId: "tenant-1",
            source: MessageSource.LINE,
            lineChannelId: "line-channel-2",
            externalThreadId: "U123"
          }
        }
      })
    );
    expect(prisma.message.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          lineChannelId: "line-channel-2",
          type: MessageType.STICKER,
          externalMessageId: "sticker-msg-1",
          text: null,
          rawPayload: expect.objectContaining({
            message: expect.objectContaining({
              type: "sticker",
              packageId: "11538",
              stickerId: "51626494"
            })
          })
        })
      })
    );
  });

  it("keeps the same LINE user in separate conversations for separate OA channels", async () => {
    const prisma = createPrisma();
    prisma.lineChannel.findFirst
      .mockResolvedValueOnce({
        id: "line-channel-1",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        encryptedChannelSecret: "encrypted-secret-1",
        encryptedChannelAccessToken: "encrypted-token-1"
      })
      .mockResolvedValueOnce({
        id: "line-channel-2",
        tenantId: "tenant-1",
        workspaceId: "workspace-1",
        encryptedChannelSecret: "encrypted-secret-2",
        encryptedChannelAccessToken: "encrypted-token-2"
      });
    prisma.conversation.upsert
      .mockResolvedValueOnce({ id: "conversation-1" })
      .mockResolvedValueOnce({ id: "conversation-2" });
    prisma.message.upsert
      .mockResolvedValueOnce({ id: "message-1" })
      .mockResolvedValueOnce({ id: "message-2" });
    prisma.lineChannel.update
      .mockResolvedValueOnce({ id: "line-channel-1" })
      .mockResolvedValueOnce({ id: "line-channel-2" });
    prisma.auditLog.create
      .mockResolvedValueOnce({ id: "audit-1" })
      .mockResolvedValueOnce({ id: "audit-2" });
    const crypto = {
      decrypt: jest.fn().mockReturnValue("channel-token"),
      encrypt: jest.fn()
    } as unknown as CryptoSecretService;
    const service = new LineWebhookService(prisma as unknown as PrismaService, crypto);

    await service.process("2009897327", {
      events: [
        {
          type: "message",
          source: { type: "user", userId: "U-same" },
          message: { id: "msg-oa-1", type: "text", text: "from OA 1" },
          timestamp: 1700000000000
        }
      ]
    });
    await service.process("1656471223", {
      events: [
        {
          type: "message",
          source: { type: "user", userId: "U-same" },
          message: { id: "msg-oa-2", type: "text", text: "from OA 2" },
          timestamp: 1700000001000
        }
      ]
    });

    expect(prisma.conversation.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          tenantId_source_lineChannelId_externalThreadId: {
            tenantId: "tenant-1",
            source: MessageSource.LINE,
            lineChannelId: "line-channel-1",
            externalThreadId: "U-same"
          }
        }
      })
    );
    expect(prisma.conversation.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          tenantId_source_lineChannelId_externalThreadId: {
            tenantId: "tenant-1",
            source: MessageSource.LINE,
            lineChannelId: "line-channel-2",
            externalThreadId: "U-same"
          }
        }
      })
    );
    expect(prisma.message.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({
          conversationId: "conversation-2",
          lineChannelId: "line-channel-2",
          text: "from OA 2"
        })
      })
    );
  });
});
