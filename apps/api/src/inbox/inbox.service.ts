import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Conversation, Message } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ConversationStatus } from "./dto/update-conversation-status.dto";

export type InboxConversation = Conversation & {
  lineChannel: {
    id: string;
    name: string;
    lineChannelId: string;
    badgeColor: string;
  };
  messages: {
    id: string;
    direction: Message["direction"];
    type: Message["type"];
    text: string | null;
    rawPayload: Message["rawPayload"];
    createdAt: Date;
    sentAt: Date | null;
  }[];
};

export type InboxSettings = {
  inProgressAlertMinutes: number;
};

export type ListConversationsOptions = {
  limit?: number;
  offset?: number;
};

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) { }

  listConversations(
    tenantId: string,
    options: ListConversationsOptions = {}
  ): Promise<InboxConversation[]> {
    const limit = clampInteger(options.limit ?? 10, 1, 50);
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));

    return this.prisma.conversation.findMany({
      where: {
        tenantId,
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
        }
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      skip: offset,
      take: limit
    });
  }

  async getConversationMessages(
    tenantId: string,
    conversationId: string
  ): Promise<Message[]> {
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

    return this.prisma.message.findMany({
      where: {
        tenantId,
        conversationId,
        deletedAt: null
      },
      orderBy: { createdAt: "asc" },
      take: 200
    });
  }

  async renameCustomer(
    tenantId: string,
    userId: string,
    conversationId: string,
    nickname: string
  ): Promise<Conversation> {
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

    const cleanNickname = nickname.trim();
    const updatedConversation = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { nickname: cleanNickname }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.CONVERSATION_CUSTOMER_RENAMED,
        targetType: "Conversation",
        targetId: conversation.id,
        metadata: {
          previousNickname: conversation.nickname,
          nickname: cleanNickname
        }
      }
    });

    return updatedConversation;
  }

  async updateStatus(
    tenantId: string,
    userId: string,
    conversationId: string,
    status: ConversationStatus
  ): Promise<Conversation> {
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

    const updatedConversation = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status,
        inProgressStartedAt:
          status === "IN_PROGRESS"
            ? conversation.inProgressStartedAt ?? new Date()
            : null
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.CONVERSATION_STATUS_CHANGED,
        targetType: "Conversation",
        targetId: conversation.id,
        metadata: {
          previousStatus: conversation.status,
          status
        }
      }
    });

    return updatedConversation;
  }

  async getSettings(tenantId: string): Promise<InboxSettings> {
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { inProgressAlertMinutes: true }
    });

    return {
      inProgressAlertMinutes: settings?.inProgressAlertMinutes ?? 10
    };
  }

  async updateSettings(
    tenantId: string,
    userId: string,
    inProgressAlertMinutes: number
  ): Promise<InboxSettings> {
    const settings = await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, inProgressAlertMinutes },
      update: { inProgressAlertMinutes },
      select: { inProgressAlertMinutes: true }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.INBOX_SETTINGS_UPDATED,
        targetType: "TenantSettings",
        targetId: tenantId,
        metadata: { inProgressAlertMinutes }
      }
    });

    return settings;
  }
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.trunc(value)));
}
