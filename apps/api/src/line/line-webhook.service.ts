import { Injectable, NotFoundException } from "@nestjs/common";
import {
  AuditAction,
  FileType,
  MessageDirection,
  MessageSource,
  MessageType,
  RetentionType
} from "@prisma/client";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { StorageService } from "../storage/storage.service";

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
  markAsReadToken?: string;
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
    private readonly cryptoSecret: CryptoSecretService,
    private readonly realtimeService?: RealtimeService,
    private readonly storageService?: StorageService
  ) { }

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
      if (event.type === "follow") {
        await this.handleFollow(channel, event);
        continue;
      }
      if (event.type === "unfollow") {
        await this.handleUnfollow(channel, event);
        continue;
      }
      if (event.type === "unsend") {
        await this.handleUnsend(channel, event);
        continue;
      }

      if (event.type !== "message") {
        continue;
      }
      const messageType = this.messageType(event);
      if (!messageType) {
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

      let mediaData: {
        mediaUrl?: string;
        mediaMimeType?: string;
        mediaSize?: number;
        mediaR2Key?: string;
        mediaFileName?: string;
      } = {};

      const isMedia = ([MessageType.IMAGE, MessageType.VIDEO, MessageType.AUDIO, MessageType.FILE] as MessageType[]).includes(messageType);
      if (isMedia && this.storageService) {
        try {
          const accessToken = this.cryptoSecret.decrypt(channel.encryptedChannelAccessToken);
          const buffer = await this.downloadLineContent(lineMessage.id, accessToken);
          
          let fileName = `media_${lineMessage.id}`;
          let mimeType = "application/octet-stream";
          let fileTypeClass: FileType = FileType.DOCUMENT;

          if (messageType === MessageType.IMAGE) {
            fileName = `image_${lineMessage.id}.jpg`;
            mimeType = "image/jpeg";
            fileTypeClass = FileType.IMAGE;
          } else if (messageType === MessageType.VIDEO) {
            fileName = `video_${lineMessage.id}.mp4`;
            mimeType = "video/mp4";
            fileTypeClass = FileType.VIDEO;
          } else if (messageType === MessageType.AUDIO) {
            fileName = `audio_${lineMessage.id}.m4a`;
            mimeType = "audio/x-m4a";
            fileTypeClass = FileType.AUDIO;
          } else if (messageType === MessageType.FILE) {
            fileName = (lineMessage as any).fileName || `file_${lineMessage.id}`;
            fileTypeClass = FileType.DOCUMENT;
            // Map common extensions
            const ext = fileName.split(".").pop()?.toLowerCase();
            if (ext === "pdf") mimeType = "application/pdf";
            else if (ext === "doc" || ext === "docx") mimeType = "application/msword";
            else if (ext === "xls" || ext === "xlsx") mimeType = "application/vnd.ms-excel";
            else if (ext === "png") mimeType = "image/png";
            else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
          }

          const uploadResult = await this.storageService.uploadFile(
            channel.tenantId,
            conversation.id,
            fileTypeClass,
            RetentionType.TEMPORARY,
            buffer,
            fileName,
            mimeType
          );

          mediaData = {
            mediaUrl: uploadResult.publicUrl,
            mediaMimeType: uploadResult.mimeType,
            mediaSize: uploadResult.fileSize,
            mediaR2Key: uploadResult.r2Key,
            mediaFileName: uploadResult.fileName
          };
        } catch (downloadErr) {
          // Create webhook failed audit log
          await this.prisma.auditLog.create({
            data: {
              tenantId: channel.tenantId,
              action: AuditAction.LINE_WEBHOOK_FAILED,
              targetType: "Message",
              targetId: lineMessage.id,
              metadata: {
                error: downloadErr instanceof Error ? downloadErr.message : "Media download failed"
              }
            }
          }).catch(() => {});
        }
      }

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
          markAsReadToken: event.markAsReadToken,
          rawPayload: lineProfile ? { ...event, lineProfile } : event,
          sentAt: eventTime,
          ...mediaData
        },
        update: {
          markAsReadToken: event.markAsReadToken,
          rawPayload: lineProfile ? { ...event, lineProfile } : event,
          ...mediaData
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

      await this.realtimeService?.publishTenantEvent(channel.tenantId, "message.created", {
        conversationId: conversation.id,
        messageId: message.id,
        lineChannelId: channel.id,
        direction: MessageDirection.INBOUND
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
    if (event.message?.type === "image") {
      return MessageType.IMAGE;
    }
    if (event.message?.type === "video") {
      return MessageType.VIDEO;
    }
    if (event.message?.type === "audio") {
      return MessageType.AUDIO;
    }
    if (event.message?.type === "file") {
      return MessageType.FILE;
    }
    return undefined;
  }

  private async downloadLineContent(messageId: string, accessToken: string): Promise<Buffer> {
    const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
      throw new Error(`Failed to download LINE content: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
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

  private async handleFollow(channel: any, event: LineWebhookEvent): Promise<void> {
    const externalThreadId = this.externalThreadId(event);
    if (!externalThreadId) return;

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
        lastMessageAt: eventTime,
        status: "OPEN"
      },
      update: {
        displayName: lineProfile?.displayName,
        lastMessageAt: eventTime,
        deletedAt: null
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: channel.tenantId,
        action: AuditAction.LINE_FOLLOW_RECEIVED,
        targetType: "Conversation",
        targetId: conversation.id,
        metadata: {
          lineChannelId: channel.id,
          externalThreadId
        }
      }
    });

    await this.realtimeService?.publishTenantEvent(channel.tenantId, "conversation.updated", {
      conversationId: conversation.id,
      status: conversation.status
    });
  }

  private async handleUnfollow(channel: any, event: LineWebhookEvent): Promise<void> {
    const externalThreadId = this.externalThreadId(event);
    if (!externalThreadId) return;

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        tenantId: channel.tenantId,
        source: MessageSource.LINE,
        lineChannelId: channel.id,
        externalThreadId,
        deletedAt: null
      }
    });

    if (conversation) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: channel.tenantId,
          action: AuditAction.LINE_UNFOLLOW_RECEIVED,
          targetType: "Conversation",
          targetId: conversation.id,
          metadata: {
            lineChannelId: channel.id,
            externalThreadId
          }
        }
      });
    }
  }

  private async handleUnsend(channel: any, event: any): Promise<void> {
    const unsendMessageId = event.unsend?.messageId;
    if (!unsendMessageId) return;

    const message = await this.prisma.message.findFirst({
      where: {
        lineChannelId: channel.id,
        externalMessageId: unsendMessageId,
        deletedAt: null
      }
    });

    if (message) {
      const now = new Date();
      await this.prisma.message.update({
        where: { id: message.id },
        data: { deletedAt: now }
      });

      await this.prisma.auditLog.create({
        data: {
          tenantId: channel.tenantId,
          action: AuditAction.LINE_UNSEND_RECEIVED,
          targetType: "Message",
          targetId: message.id,
          metadata: {
            lineChannelId: channel.id,
            externalMessageId: unsendMessageId
          }
        }
      });

      await this.realtimeService?.publishTenantEvent(channel.tenantId, "message.deleted", {
        conversationId: message.conversationId,
        messageId: message.id
      });
    }
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
