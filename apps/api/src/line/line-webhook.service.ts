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
    packageId?: string;
    stickerId?: string;
    stickerResourceType?: string;
  };
  timestamp?: number;
};

type LineProfile = {
  displayName?: string;
  pictureUrl?: string;
  statusMessage?: string;
  language?: string;
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
      const messageType = this.messageType(event);
      if (event.type !== "message" || !messageType) {
        continue;
      }

      const externalThreadId = this.externalThreadId(event);
      const lineMessage = event.message;
      if (!externalThreadId || !lineMessage?.id) {
        continue;
      }

      const lineProfile = await this.loadLineProfile(channel.encryptedChannelAccessToken, event);
      const eventTime = event.timestamp ? new Date(event.timestamp) : new Date();
      const conversation = await this.prisma.conversation.upsert({
        where: {
          tenantId_source_lineChannelId_externalThreadId: {
            tenantId: channel.tenantId,
            source: MessageSource.LINE,
            lineChannelId: channel.id,
            externalThreadId
          }
        },
        create: {
          tenantId: channel.tenantId,
          workspaceId: channel.workspaceId,
          lineChannelId: channel.id,
          source: MessageSource.LINE,
          externalThreadId,
          displayName: lineProfile?.displayName,
          lastMessageAt: eventTime
        },
        update: {
          displayName: lineProfile?.displayName,
          lastMessageAt: eventTime
        }
      });

      const message = await this.prisma.message.upsert({
        where: {
          lineChannelId_externalMessageId: {
            lineChannelId: channel.id,
            externalMessageId: lineMessage.id
          }
        },
        create: {
          tenantId: channel.tenantId,
          conversationId: conversation.id,
          lineChannelId: channel.id,
          direction: MessageDirection.INBOUND,
          source: MessageSource.LINE,
          type: messageType,
          externalMessageId: lineMessage.id,
          text: messageType === MessageType.TEXT ? lineMessage.text : null,
          rawPayload: lineProfile ? { ...event, lineProfile } : event,
          sentAt: eventTime
        },
        update: {
          rawPayload: lineProfile ? { ...event, lineProfile } : event
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
            externalMessageId: lineMessage.id
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

  private messageType(event: LineWebhookEvent): MessageType | undefined {
    if (event.message?.type === "text") {
      return MessageType.TEXT;
    }
    if (event.message?.type === "sticker") {
      return MessageType.STICKER;
    }
    return undefined;
  }

  private async loadLineProfile(
    encryptedChannelAccessToken: string,
    event: LineWebhookEvent
  ): Promise<LineProfile | undefined> {
    if (event.source?.type !== "user" || !event.source.userId) {
      return undefined;
    }

    try {
      const token = this.cryptoSecret.decrypt(encryptedChannelAccessToken);
      const response = await fetch(
        `https://api.line.me/v2/bot/profile/${event.source.userId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!response.ok) {
        return undefined;
      }
      return this.toLineProfile(await response.json());
    } catch {
      return undefined;
    }
  }

  private toLineProfile(value: unknown): LineProfile | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    const profile = value as Record<string, unknown>;
    const displayName = readString(profile.displayName);
    if (!displayName) {
      return undefined;
    }

    return {
      displayName,
      pictureUrl: readString(profile.pictureUrl),
      statusMessage: readString(profile.statusMessage),
      language: readString(profile.language)
    };
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
