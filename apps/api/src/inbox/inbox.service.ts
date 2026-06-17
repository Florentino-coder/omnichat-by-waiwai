import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AuditAction,
  Conversation,
  ConversationInternalNote,
  ConversationPriority,
  ConversationTag,
  ConversationTagLink,
  Message,
  Role,
  SavedReply,
  LineChannel,
  WorkspaceMember
} from "@prisma/client";
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

export type ListSavedRepliesOptions = {
  lineChannelId?: string;
  userId?: string;
  type?: "all" | "shared" | "personal";
};

export type CreateSavedReplyInput = {
  lineChannelId?: string;
  userId?: string;
  title: string;
  body: string;
  shortcutKey?: string;
  imageUrl?: string;
  hotkeyBinding?: string;
};

export type UpdateSavedReplyInput = {
  lineChannelId?: string;
  userId?: string;
  title?: string;
  body?: string;
  shortcutKey?: string;
  imageUrl?: string;
  hotkeyBinding?: string;
  isActive?: boolean;
};

export type CreateTagInput = {
  name: string;
  color?: string;
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
        },
        tagLinks: {
          where: { deletedAt: null },
          include: {
            tag: true
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

  async assignConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
    memberId: string | null
  ): Promise<Conversation> {
    const conversation = await this.findTenantConversation(tenantId, conversationId);

    if (memberId) {
      await this.findTenantMember(tenantId, memberId);
    }

    const updatedConversation = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { assignedToMemberId: memberId }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: memberId ? AuditAction.CONVERSATION_ASSIGNED : AuditAction.CONVERSATION_UNASSIGNED,
        targetType: "Conversation",
        targetId: conversation.id,
        metadata: {
          previousAssignedToMemberId: conversation.assignedToMemberId,
          assignedToMemberId: memberId
        }
      }
    });

    return updatedConversation;
  }

  async updatePriority(
    tenantId: string,
    userId: string,
    conversationId: string,
    priority: ConversationPriority
  ): Promise<Conversation> {
    const conversation = await this.findTenantConversation(tenantId, conversationId);

    const updatedConversation = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { priority }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.CONVERSATION_PRIORITY_CHANGED,
        targetType: "Conversation",
        targetId: conversation.id,
        metadata: {
          previousPriority: conversation.priority,
          priority
        }
      }
    });

    return updatedConversation;
  }

  listTags(tenantId: string): Promise<ConversationTag[]> {
    return this.prisma.conversationTag.findMany({
      where: {
        tenantId,
        deletedAt: null
      },
      orderBy: [{ name: "asc" }, { createdAt: "desc" }]
    });
  }

  async createTag(
    tenantId: string,
    userId: string,
    input: CreateTagInput
  ): Promise<ConversationTag> {
    const tag = await this.prisma.conversationTag.create({
      data: {
        tenantId,
        name: input.name.trim(),
        color: input.color ?? "#64748b"
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.CONVERSATION_TAG_CREATED,
        targetType: "ConversationTag",
        targetId: tag.id,
        metadata: {
          name: tag.name,
          color: tag.color
        }
      }
    });

    return tag;
  }

  async updateTag(
    tenantId: string,
    userId: string,
    tagId: string,
    input: Partial<CreateTagInput>
  ): Promise<ConversationTag> {
    const tag = await this.findTenantTag(tenantId, tagId);
    const data: { name?: string; color?: string } = {};

    if (input.name !== undefined) {
      data.name = input.name.trim();
    }
    if (input.color !== undefined) {
      data.color = input.color;
    }

    const updatedTag = await this.prisma.conversationTag.update({
      where: { id: tag.id },
      data
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.CONVERSATION_TAG_UPDATED,
        targetType: "ConversationTag",
        targetId: tag.id,
        metadata: data
      }
    });

    return updatedTag;
  }

  async deleteTag(
    tenantId: string,
    userId: string,
    tagId: string
  ): Promise<ConversationTag> {
    const tag = await this.findTenantTag(tenantId, tagId);
    const deletedTag = await this.prisma.conversationTag.update({
      where: { id: tag.id },
      data: { deletedAt: new Date() }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.CONVERSATION_TAG_DELETED,
        targetType: "ConversationTag",
        targetId: tag.id,
        metadata: {
          name: tag.name
        }
      }
    });

    return deletedTag;
  }

  async addConversationTag(
    tenantId: string,
    userId: string,
    conversationId: string,
    tagId: string
  ): Promise<ConversationTagLink> {
    const conversation = await this.findTenantConversation(tenantId, conversationId);
    const tag = await this.findTenantTag(tenantId, tagId);
    const existingLink = await this.prisma.conversationTagLink.findFirst({
      where: {
        tenantId,
        conversationId: conversation.id,
        tagId: tag.id
      }
    });

    const link =
      existingLink && existingLink.deletedAt === null
        ? existingLink
        : existingLink
          ? await this.prisma.conversationTagLink.update({
              where: { id: existingLink.id },
              data: { deletedAt: null }
            })
          : await this.prisma.conversationTagLink.create({
              data: {
                tenantId,
                conversationId: conversation.id,
                tagId: tag.id
              }
            });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.CONVERSATION_TAG_ADDED,
        targetType: "Conversation",
        targetId: conversation.id,
        metadata: {
          tagId: tag.id,
          tagName: tag.name
        }
      }
    });

    return link;
  }

  async removeConversationTag(
    tenantId: string,
    userId: string,
    conversationId: string,
    tagId: string
  ): Promise<ConversationTagLink> {
    const conversation = await this.findTenantConversation(tenantId, conversationId);
    const tag = await this.findTenantTag(tenantId, tagId);
    const link = await this.prisma.conversationTagLink.findFirst({
      where: {
        tenantId,
        conversationId: conversation.id,
        tagId: tag.id,
        deletedAt: null
      }
    });

    if (!link) {
      throw new NotFoundException("Conversation tag link not found");
    }

    const updatedLink = await this.prisma.conversationTagLink.update({
      where: { id: link.id },
      data: { deletedAt: new Date() }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.CONVERSATION_TAG_REMOVED,
        targetType: "Conversation",
        targetId: conversation.id,
        metadata: {
          tagId: tag.id,
          tagName: tag.name
        }
      }
    });

    return updatedLink;
  }

  async createNote(
    tenantId: string,
    userId: string,
    conversationId: string,
    body: string
  ): Promise<ConversationInternalNote> {
    const conversation = await this.findTenantConversation(tenantId, conversationId);
    const authorMember = await this.findActorMember(tenantId, userId);
    const note = await this.prisma.conversationInternalNote.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        authorMemberId: authorMember.id,
        body: body.trim()
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.CONVERSATION_NOTE_CREATED,
        targetType: "Conversation",
        targetId: conversation.id,
        metadata: {
          noteId: note.id
        }
      }
    });

    return note;
  }

  async listNotes(
    tenantId: string,
    conversationId: string
  ): Promise<ConversationInternalNote[]> {
    const conversation = await this.findTenantConversation(tenantId, conversationId);

    return this.prisma.conversationInternalNote.findMany({
      where: {
        tenantId,
        conversationId: conversation.id,
        deletedAt: null
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  async deleteNote(
    tenantId: string,
    userId: string,
    role: Role,
    conversationId: string,
    noteId: string
  ): Promise<ConversationInternalNote> {
    const conversation = await this.findTenantConversation(tenantId, conversationId);
    const actor = await this.findActorMember(tenantId, userId);
    const note = await this.prisma.conversationInternalNote.findFirst({
      where: {
        id: noteId,
        tenantId,
        conversationId: conversation.id,
        deletedAt: null
      }
    });

    if (!note) {
      throw new NotFoundException("Conversation note not found");
    }
    if (role !== Role.ADMIN && role !== Role.OWNER && note.authorMemberId !== actor.id) {
      throw new ForbiddenException("Cannot delete another member's note");
    }

    const deletedNote = await this.prisma.conversationInternalNote.update({
      where: { id: note.id },
      data: { deletedAt: new Date() }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.CONVERSATION_NOTE_DELETED,
        targetType: "Conversation",
        targetId: conversation.id,
        metadata: {
          noteId: note.id
        }
      }
    });

    return deletedNote;
  }

  listSavedReplies(
    tenantId: string,
    options: ListSavedRepliesOptions = {}
  ): Promise<SavedReply[]> {
    const where: any = {
      tenantId,
      deletedAt: null,
      isActive: true
    };

    if (options.lineChannelId) {
      where.lineChannelId = options.lineChannelId;
    }

    if (options.type === "shared") {
      where.userId = null;
    } else if (options.type === "personal") {
      where.userId = options.userId || "NOT_FOUND";
    } else if (options.type === "all") {
      where.OR = [
        { userId: null },
        { userId: options.userId || "" }
      ];
    } else {
      if (options.userId) {
        where.OR = [
          { userId: null },
          { userId: options.userId }
        ];
      }
    }

    return this.prisma.savedReply.findMany({
      where,
      orderBy: [{ title: "asc" }, { createdAt: "desc" }]
    });
  }

  async createSavedReply(
    tenantId: string,
    userId: string,
    input: CreateSavedReplyInput
  ): Promise<SavedReply> {
    const lineChannelId = input.lineChannelId?.trim();
    if (lineChannelId) {
      await this.findTenantLineChannel(tenantId, lineChannelId);
    }

    const savedReply = await this.prisma.savedReply.create({
      data: {
        tenantId,
        lineChannelId: lineChannelId || null,
        userId: input.userId || null,
        title: input.title.trim(),
        body: input.body.trim(),
        shortcutKey: input.shortcutKey?.trim() || null,
        imageUrl: input.imageUrl?.trim() || null,
        hotkeyBinding: input.hotkeyBinding?.trim() || null
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.SAVED_REPLY_CREATED,
        targetType: "SavedReply",
        targetId: savedReply.id,
        metadata: {
          lineChannelId: savedReply.lineChannelId,
          title: savedReply.title,
          isPersonal: Boolean(savedReply.userId)
        }
      }
    });

    return savedReply;
  }

  async updateSavedReply(
    tenantId: string,
    userId: string,
    userRole: string,
    id: string,
    input: UpdateSavedReplyInput
  ): Promise<SavedReply> {
    const savedReply = await this.findTenantSavedReply(tenantId, id);

    // Security check
    if (savedReply.userId && savedReply.userId !== userId && userRole !== "OWNER" && userRole !== "ADMIN") {
      throw new ForbiddenException("You do not have permission to modify this personal quick reply");
    }
    if (!savedReply.userId && userRole !== "OWNER" && userRole !== "ADMIN") {
      throw new ForbiddenException("Only administrators can modify shared quick replies");
    }

    const data: any = {};

    if (input.lineChannelId !== undefined) {
      const lineChannelId = input.lineChannelId ? input.lineChannelId.trim() : null;
      if (lineChannelId) {
        await this.findTenantLineChannel(tenantId, lineChannelId);
      }
      data.lineChannelId = lineChannelId;
    }

    if (input.title !== undefined) {
      data.title = input.title.trim();
    }
    if (input.body !== undefined) {
      data.body = input.body.trim();
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }
    if (input.shortcutKey !== undefined) {
      data.shortcutKey = input.shortcutKey ? input.shortcutKey.trim() : null;
    }
    if (input.imageUrl !== undefined) {
      data.imageUrl = input.imageUrl ? input.imageUrl.trim() : null;
    }
    if (input.hotkeyBinding !== undefined) {
      data.hotkeyBinding = input.hotkeyBinding ? input.hotkeyBinding.trim() : null;
    }

    const updatedSavedReply = await this.prisma.savedReply.update({
      where: { id: savedReply.id },
      data
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.SAVED_REPLY_UPDATED,
        targetType: "SavedReply",
        targetId: savedReply.id,
        metadata: data
      }
    });

    return updatedSavedReply;
  }

  async deleteSavedReply(
    tenantId: string,
    userId: string,
    userRole: string,
    id: string
  ): Promise<SavedReply> {
    const savedReply = await this.findTenantSavedReply(tenantId, id);

    // Security check
    if (savedReply.userId && savedReply.userId !== userId && userRole !== "OWNER" && userRole !== "ADMIN") {
      throw new ForbiddenException("You do not have permission to delete this personal quick reply");
    }
    if (!savedReply.userId && userRole !== "OWNER" && userRole !== "ADMIN") {
      throw new ForbiddenException("Only administrators can delete shared quick replies");
    }

    const deletedSavedReply = await this.prisma.savedReply.update({
      where: { id: savedReply.id },
      data: { deletedAt: new Date(), isActive: false }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.SAVED_REPLY_DELETED,
        targetType: "SavedReply",
        targetId: savedReply.id,
        metadata: {
          title: savedReply.title
        }
      }
    });

    return deletedSavedReply;
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

  private async findTenantConversation(
    tenantId: string,
    conversationId: string
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

    return conversation;
  }

  private async findTenantMember(
    tenantId: string,
    memberId: string
  ): Promise<WorkspaceMember> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        id: memberId,
        tenantId,
        isActive: true
      }
    });

    if (!member) {
      throw new NotFoundException("Workspace member not found");
    }

    return member;
  }

  private async findActorMember(
    tenantId: string,
    userId: string
  ): Promise<WorkspaceMember> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        tenantId,
        userId,
        isActive: true
      }
    });

    if (!member) {
      throw new NotFoundException("Workspace member not found");
    }

    return member;
  }

  private async findTenantTag(tenantId: string, tagId: string): Promise<ConversationTag> {
    const tag = await this.prisma.conversationTag.findFirst({
      where: {
        id: tagId,
        tenantId,
        deletedAt: null
      }
    });

    if (!tag) {
      throw new NotFoundException("Conversation tag not found");
    }

    return tag;
  }

  private async findTenantSavedReply(tenantId: string, id: string): Promise<SavedReply> {
    const savedReply = await this.prisma.savedReply.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!savedReply) {
      throw new NotFoundException("Saved reply not found");
    }

    return savedReply;
  }

  private async findTenantLineChannel(tenantId: string, id: string): Promise<LineChannel> {
    const lineChannel = await this.prisma.lineChannel.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
        isActive: true
      }
    });

    if (!lineChannel) {
      throw new NotFoundException("LINE channel not found");
    }

    return lineChannel;
  }
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.trunc(value)));
}
