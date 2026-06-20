import {
  AiAgentGender,
  MessageDirection,
  MessageSource,
  MessageType,
  PrismaClient
} from "@prisma/client";
import { createCipheriv, randomBytes } from "crypto";
import { TenantFixture } from "./stage-1-fixtures";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";

export interface InboxAiFixture {
  lineChannelId: string;
  customerId: string;
  conversationId: string;
  inboundMessageId: string;
}

function encryptionKey(): Buffer {
  const value = process.env.ENCRYPTION_KEY ?? Buffer.alloc(32, 7).toString("base64");
  return Buffer.from(value, "base64");
}

function encryptSecretForTest(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64")).join(".");
}

export async function createInboxAiFixture(
  prisma: PrismaClient,
  fixture: TenantFixture,
  slug: string
): Promise<InboxAiFixture> {
  await prisma.tenantSettings.update({
    where: { tenantId: fixture.tenantId },
    data: {
      enableAiSuggest: true,
      aiProvider: "gemini",
      aiAgentGender: AiAgentGender.FEMALE
    }
  });

  await prisma.promptTemplate.upsert({
    where: {
      tenantId_name: {
        tenantId: fixture.tenantId,
        name: "suggested_reply_default"
      }
    },
    update: {
      systemPrompt:
        "คุณเป็นผู้ช่วยตอบแชทลูกค้า ตอบสั้น สุภาพ ใช้ {{customer_name}} {{tags}} {{internal_notes}} {{conversation_history}}"
    },
    create: {
      tenantId: fixture.tenantId,
      name: "suggested_reply_default",
      systemPrompt:
        "คุณเป็นผู้ช่วยตอบแชทลูกค้า ตอบสั้น สุภาพ ใช้ {{customer_name}} {{tags}} {{internal_notes}} {{conversation_history}}"
    }
  });

  const customer = await prisma.customer.create({
    data: {
      tenantId: fixture.tenantId,
      displayName: `${slug} Customer`
    }
  });

  await prisma.customerChannel.create({
    data: {
      tenantId: fixture.tenantId,
      customerId: customer.id,
      channelType: "line",
      channelUserId: `${slug}-line-user`
    }
  });

  const channel = await prisma.lineChannel.create({
    data: {
      tenantId: fixture.tenantId,
      workspaceId: fixture.workspaceId,
      name: `${slug} LINE`,
      lineChannelId: `${slug}-line-channel-id`,
      encryptedChannelSecret: encryptSecretForTest(`${slug}-secret`),
      encryptedChannelAccessToken: encryptSecretForTest(`${slug}-access-token`)
    }
  });

  const conversation = await prisma.conversation.create({
    data: {
      tenantId: fixture.tenantId,
      workspaceId: fixture.workspaceId,
      lineChannelId: channel.id,
      externalThreadId: `${slug}-thread`,
      displayName: customer.displayName,
      customerId: customer.id,
      lastMessageAt: new Date("2026-06-21T10:00:00.000Z")
    }
  });

  const inboundMessage = await prisma.message.create({
    data: {
      tenantId: fixture.tenantId,
      conversationId: conversation.id,
      lineChannelId: channel.id,
      direction: MessageDirection.INBOUND,
      source: MessageSource.LINE,
      type: MessageType.TEXT,
      externalMessageId: `${slug}-inbound-message`,
      text: `${slug} customer question`,
      sentAt: new Date("2026-06-21T10:00:00.000Z")
    }
  });

  return {
    lineChannelId: channel.id,
    customerId: customer.id,
    conversationId: conversation.id,
    inboundMessageId: inboundMessage.id
  };
}

export function mockLinePushSuccess(): jest.Mock {
  const originalFetch = globalThis.fetch.bind(globalThis);

  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("api.line.me/v2/bot/message/push")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({})
      } as Response;
    }
    return originalFetch(input, init);
  });
}
