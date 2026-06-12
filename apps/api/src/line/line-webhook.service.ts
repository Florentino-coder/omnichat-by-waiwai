import { Injectable, NotFoundException } from "@nestjs/common";
import {
  AuditAction,
  MessageDirection,
  MessageSource,
  MessageType
} from "@prisma/client";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PrismaService } from "../prisma/prisma.service";

type LineWebhookPayload = {
  events?: LineWebhookEvent[];
};

type LineWebhookEvent = {
  type?: string;
  source?: {
    type?: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    id?: string;
    type?: string;
    text?: string;
  };
  timestamp?: number;
};

@Injectable()
export class LineWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoSecret: CryptoSecretService
  ) {}

  async getChannelSecret(lineChannelId: string): Promise<string> {
    const channel = await this.prisma.lineChannel.findFirst({
      where: {
        lineChannelId,
        deletedAt: null,
        isActive: true
      }
    });

    if (!channel) {
      throw new NotFoundException("LINE channel not found");
    }

    return this.cryptoSecret.decrypt(channel.encryptedChannelSecret);
  }

  async process(lineChannelId: string, payload: LineWebhookPayload): Promise<void> {
    const channel = await this.prisma.lineChannel.findFirst({
      where: {
        lineChannelId,
        deletedAt: null,
        isActive: true
      }
    });

    if (!channel) {
      throw new NotFoundException("LINE channel not found");
    }

    const events = payload.events ?? [];
    for (const event of events) {
      if (event.type !== "message" || event.message?.type !== "text") {
        continue;
      }

      const externalThreadId = this.externalThreadId(event);
      if (!externalThreadId || !event.message.id) {
        continue;
      }

      const eventTime = event.timestamp ? new Date(event.timestamp) : new Date();
      const conversation = await this.prisma.conversation.upsert({
        where: {
          tenantId_source_externalThreadId: {
            tenantId: channel.tenantId,
            source: MessageSource.LINE,
            externalThreadId
          }
        },
        create: {
          tenantId: channel.tenantId,
          workspaceId: channel.workspaceId,
          lineChannelId: channel.id,
          source: MessageSource.LINE,
          externalThreadId,
          lastMessageAt: eventTime
        },
        update: {
          lastMessageAt: eventTime
        }
      });

      const message = await this.prisma.message.upsert({
        where: {
          lineChannelId_externalMessageId: {
            lineChannelId: channel.id,
            externalMessageId: event.message.id
          }
        },
        create: {
          tenantId: channel.tenantId,
          conversationId: conversation.id,
          lineChannelId: channel.id,
          direction: MessageDirection.INBOUND,
          source: MessageSource.LINE,
          type: MessageType.TEXT,
          externalMessageId: event.message.id,
          text: event.message.text,
          rawPayload: event,
          sentAt: eventTime
        },
        update: {
          rawPayload: event
        }
      });

      await this.prisma.auditLog.create({
        data: {
          tenantId: channel.tenantId,
          action: AuditAction.LINE_MESSAGE_RECEIVED,
          targetType: "Message",
          targetId: message.id,
          metadata: {
            lineChannelId: channel.id,
            externalMessageId: event.message.id
          }
        }
      });
    }

    await this.prisma.lineChannel.update({
      where: { id: channel.id },
      data: { lastWebhookAt: new Date() }
    });
  }

  private externalThreadId(event: LineWebhookEvent): string | undefined {
    return event.source?.userId ?? event.source?.groupId ?? event.source?.roomId;
  }
}
