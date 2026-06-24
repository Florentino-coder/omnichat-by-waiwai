import { Injectable, NotFoundException, BadGatewayException } from "@nestjs/common";
import {
  AuditAction,
  MessageDirection,
  MessageSource,
  MessageType
} from "@prisma/client";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { ReplyLineMessageDto } from "./dto/reply-line-message.dto";

@Injectable()
export class LineReplyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoSecret: CryptoSecretService,
    private readonly realtimeService?: RealtimeService
  ) { }

  async replyText(
    tenantId: string,
    userId: string,
    conversationId: string,
    dto: ReplyLineMessageDto
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
        deletedAt: null
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const channel = await this.prisma.lineChannel.findFirst({
      where: {
        id: conversation.lineChannelId,
        tenantId,
        deletedAt: null,
        isActive: true
      }
    });

    if (!channel) {
      throw new NotFoundException("LINE channel not found");
    }

    const token = this.cryptoSecret.decrypt(channel.encryptedChannelAccessToken);
    const lineMessage = dto.imageUrl
      ? {
          type: "image",
          originalContentUrl: dto.imageUrl,
          previewImageUrl: dto.imageUrl
        }
      : {
          type: "text",
          text: dto.text
        };
    const storedText = dto.imageUrl ? `Image: ${dto.imageUrl}` : dto.text;
    const storedType = dto.imageUrl ? MessageType.UNKNOWN : MessageType.TEXT;

    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: conversation.externalThreadId,
        messages: [lineMessage]
      })
    });

    if (!response.ok) {
      throw new BadGatewayException(`LINE reply failed with status ${response.status}`);
    }

    const sentAt = new Date();
    const isSystem = userId === "automation" || userId === "system";
    const message = await this.prisma.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        lineChannelId: channel.id,
        direction: MessageDirection.OUTBOUND,
        source: MessageSource.LINE,
        type: storedType,
        text: storedText,
        sentAt,
        ...(isSystem
          ? { rawPayload: { omnichatMeta: { triggeredBy: userId } } }
          : {})
      }
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: sentAt }
    });

    if (!isSystem) {
      await this.prisma.aiSuggestion.updateMany({
        where: {
          conversationId: conversation.id,
          tenantId,
          status: "shown"
        },
        data: {
          status: "superseded"
        }
      });
    }

    // Curation / QA learning pair logging
    if (!isSystem && dto.text) {
      const lastInbound = await this.prisma.message.findFirst({
        where: {
          conversationId: conversation.id,
          tenantId,
          direction: MessageDirection.INBOUND,
          deletedAt: null
        },
        orderBy: { createdAt: "desc" }
      });

      if (lastInbound?.text) {
        let isSuggestionUsed = false;
        let isEdited = true;
        let status = "pending";

        if (dto.aiSuggestionId) {
          const suggestion = await this.prisma.aiSuggestion.findFirst({
            where: {
              id: dto.aiSuggestionId,
              tenantId
            }
          });

          if (suggestion) {
            isSuggestionUsed = true;
            isEdited = dto.text.trim() !== (suggestion.suggestionText || "").trim();
            status = isEdited ? "pending" : "approved";
          }
        }

        await this.prisma.aiTrainingPair.create({
          data: {
            tenantId,
            conversationId: conversation.id,
            customerMessage: lastInbound.text.trim(),
            assistantReply: dto.text.trim(),
            suggestionId: dto.aiSuggestionId || null,
            isSuggestionUsed,
            isEdited,
            status
          }
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: isSystem ? null : userId,
        action: AuditAction.LINE_REPLY_SENT,
        targetType: "Message",
        targetId: message.id,
        metadata: {
          conversationId: conversation.id,
          lineChannelId: channel.id,
          ...(isSystem ? { triggeredBy: userId } : {})
        }
      }
    });

    await this.realtimeService?.publishTenantEvent(tenantId, "message.created", {
      conversationId: conversation.id,
      messageId: message.id,
      lineChannelId: channel.id,
      direction: MessageDirection.OUTBOUND
    });
  }
}
