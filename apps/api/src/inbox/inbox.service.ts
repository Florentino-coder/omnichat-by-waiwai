import { Injectable, NotFoundException } from "@nestjs/common";
import { Conversation, Message } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type InboxConversation = Conversation & {
  lineChannel: {
    id: string;
    name: string;
    lineChannelId: string;
  };
  messages: {
    id: string;
    direction: Message["direction"];
    type: Message["type"];
    text: string | null;
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
            lineChannelId: true
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
}

