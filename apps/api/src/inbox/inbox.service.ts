import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Conversation, Message } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

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

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  listConversations(tenantId: string): Promise<InboxConversation[]> {
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
      take: 100
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
}
