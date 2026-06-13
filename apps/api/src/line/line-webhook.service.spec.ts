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
        tenantId_source_externalThreadId: {
          tenantId: "tenant-1",
          source: MessageSource.LINE,
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
});
