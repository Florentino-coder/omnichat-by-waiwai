import { ForbiddenException, Injectable, NotFoundException, Logger, HttpException, HttpStatus } from "@nestjs/common";
import {
  AuditAction,
  AiAgentGender,
  Conversation,
  ConversationInternalNote,
  ConversationPriority,
  ConversationTag,
  ConversationTagLink,
  Message,
  Prisma,
  Role,
  SavedReply,
  LineChannel,
  WorkspaceMember,
  PromptTemplate
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { ConversationStatus } from "./dto/update-conversation-status.dto";
import { RedisService } from "../redis/redis.service";
import { LLMClient } from "../common/llm/llm.interface";
import { GeminiClient } from "../common/llm/gemini.client";
import { OpenAIClient } from "../common/llm/openai.client";
import { ClaudeClient } from "../common/llm/claude.client";
import { UpdateAiSuggestionDto } from "./dto/update-ai-suggestion.dto";
import { UpdateInboxSettingsDto } from "./dto/update-inbox-settings.dto";
import { AiSuggestDto } from "./dto/ai-suggest.dto";
import { AiTestDto } from "./dto/ai-test.dto";
import { PlanLimitExceededException } from "../common/exceptions/plan-limit-exceeded.exception";
import {
  AI_SUGGEST_USAGE_METRIC,
  buildAgentGenderInstruction,
  getCurrentMonthUsagePeriod,
  normalizeThaiPoliteParticles
} from "./thai-speech.util";

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
  unreadInboundMessageCount: number;
  customerDisplayName?: string | null;
};

type InboxConversationRow = Omit<InboxConversation, "unreadInboundMessageCount"> & {
  _count?: {
    messages?: number;
  };
  customer?: {
    displayName: string | null;
  } | null;
};

export type InboxSettings = {
  inProgressAlertMinutes: number;
  enableAiSuggest: boolean;
  aiProvider: string;
  aiAgentGender: AiAgentGender;
};

export type AiUsageSnapshot = {
  used: number;
  limit: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
  percentage: number;
  planId: string;
  provider: string;
  providerLabel: string;
  modelName: string;
  creditsAvailable: boolean;
};

export type AiTestResult = {
  suggestion_text: string;
  provider: string;
  provider_label: string;
  model_name: string;
  latency_ms: number;
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
  private readonly logger = new Logger(InboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoSecret: CryptoSecretService,
    private readonly redisService: RedisService,
    private readonly geminiClient: GeminiClient,
    private readonly openaiClient: OpenAIClient,
    private readonly claudeClient: ClaudeClient
  ) { }

  async listConversations(
    tenantId: string,
    options: ListConversationsOptions = {}
  ): Promise<InboxConversation[]> {
    const limit = clampInteger(options.limit ?? 10, 1, 50);
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));

    const conversations = await this.prisma.conversation.findMany({
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
        _count: {
          select: {
            messages: {
              where: {
                direction: "INBOUND",
                markAsReadToken: { not: null },
                deletedAt: null
              }
            }
          }
        },
        tagLinks: {
          where: { deletedAt: null },
          include: {
            tag: true
          }
        },
        customer: {
          select: {
            displayName: true
          }
        }
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      skip: offset,
      take: limit
    });

    return (conversations as InboxConversationRow[]).map(({ _count, customer, ...conversation }) => ({
      ...conversation,
      unreadInboundMessageCount: _count?.messages ?? 0,
      customerDisplayName: customer?.displayName ?? null
    }));
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
      select: {
        inProgressAlertMinutes: true,
        enableAiSuggest: true,
        aiProvider: true,
        aiAgentGender: true
      }
    });

    return {
      inProgressAlertMinutes: settings?.inProgressAlertMinutes ?? 10,
      enableAiSuggest: settings?.enableAiSuggest ?? true,
      aiProvider: settings?.aiProvider ?? "gemini",
      aiAgentGender: settings?.aiAgentGender ?? AiAgentGender.FEMALE
    };
  }

  async updateSettings(
    tenantId: string,
    userId: string,
    dto: UpdateInboxSettingsDto
  ): Promise<InboxSettings> {
    const settings = await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        inProgressAlertMinutes: dto.inProgressAlertMinutes ?? 10,
        enableAiSuggest: dto.enableAiSuggest ?? true,
        aiProvider: dto.aiProvider ?? "gemini",
        aiAgentGender: dto.aiAgentGender ?? AiAgentGender.FEMALE
      },
      update: {
        inProgressAlertMinutes: dto.inProgressAlertMinutes,
        enableAiSuggest: dto.enableAiSuggest,
        aiProvider: dto.aiProvider,
        aiAgentGender: dto.aiAgentGender
      },
      select: {
        inProgressAlertMinutes: true,
        enableAiSuggest: true,
        aiProvider: true,
        aiAgentGender: true
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.INBOX_SETTINGS_UPDATED,
        targetType: "TenantSettings",
        targetId: tenantId,
        metadata: {
          inProgressAlertMinutes: dto.inProgressAlertMinutes,
          enableAiSuggest: dto.enableAiSuggest,
          aiProvider: dto.aiProvider,
          aiAgentGender: dto.aiAgentGender
        }
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

  async markAsRead(
    tenantId: string,
    userId: string,
    conversationId: string
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
        deletedAt: null
      },
      include: {
        lineChannel: true
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    // Find the latest inbound message with a markAsReadToken
    const message = await this.prisma.message.findFirst({
      where: {
        tenantId,
        conversationId,
        direction: "INBOUND",
        markAsReadToken: { not: null },
        deletedAt: null
      },
      orderBy: { createdAt: "desc" }
    });

    if (!message || !message.markAsReadToken) {
      return; // Nothing to mark as read or already marked
    }

    const channel = conversation.lineChannel;
    if (!channel || !channel.isActive) {
      return; // Channel is not active
    }

    try {
      const accessToken = this.cryptoSecret.decrypt(channel.encryptedChannelAccessToken);

      const response = await fetch("https://api.line.me/v2/bot/chat/markAsRead", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          markAsReadToken: message.markAsReadToken
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`LINE markAsRead failed: ${response.status} - ${errorText}`);
      } else {
        // Update all messages in this conversation to clear their markAsReadTokens
        await this.prisma.message.updateMany({
          where: {
            tenantId,
            conversationId,
            markAsReadToken: { not: null }
          },
          data: {
            markAsReadToken: null
          }
        });

        // Log audit log
        await this.prisma.auditLog.create({
          data: {
            tenantId,
            userId,
            action: AuditAction.LINE_MARK_AS_READ,
            targetType: "Conversation",
            targetId: conversationId,
            metadata: {
              externalThreadId: conversation.externalThreadId,
              messageId: message.id
            }
          }
        });
      }
    } catch (err) {
      this.logger.error("Error executing LINE markAsRead:", err);
    }
  }

  async aiSuggest(
    tenantId: string,
    userId: string,
    conversationId: string,
    dto: AiSuggestDto
  ) {
    const actionType = dto.action_type;

    // 1. Rate limiting via Redis
    const conversationLimitKey = `ai-suggest-limit:conversation:${conversationId}`;
    const tenantLimitKey = `ai-suggest-limit:tenant:${tenantId}`;

    const [convCount, tenantCount] = await Promise.all([
      this.redisService.client.incr(conversationLimitKey),
      this.redisService.client.incr(tenantLimitKey)
    ]);

    // Set EXPIRE if key is newly created
    if (convCount === 1) {
      await this.redisService.client.expire(conversationLimitKey, 60);
    }
    if (tenantCount === 1) {
      await this.redisService.client.expire(tenantLimitKey, 60);
    }

    if (convCount > 10 || tenantCount > 60) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many AI suggestions requested. Please wait before trying again."
          }
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // 1.5 Fetch tenant settings to get active AI provider
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (settings?.enableAiSuggest === false) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: "AI_SUGGEST_DISABLED",
            message: "AI suggestions are disabled for this tenant."
          }
        },
        HttpStatus.FORBIDDEN
      );
    }

    const aiAgentGender = settings?.aiAgentGender ?? AiAgentGender.FEMALE;
    await this.assertAiCreditAvailable(tenantId, userId);

    const provider = (settings?.aiProvider || process.env.LLM_PROVIDER || "gemini").toLowerCase();

    const activeLlmClient = this.resolveLlmClient(provider);

    // 2. Fetch conversation with customer (ensure customer.deletedAt: null)
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
        deletedAt: null
      },
      include: {
        customer: true
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    if (!conversation.customerId || !conversation.customer || conversation.customer.deletedAt !== null) {
      throw new NotFoundException("Customer not found or has been deleted");
    }

    const customer = conversation.customer;

    // 3. Fetch recent 10-15 messages
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        tenantId,
        deletedAt: null
      },
      orderBy: { createdAt: "desc" },
      take: 15
    });

    // Order message history chronologically (asc)
    const history = messages.reverse();

    // Compile tags & notes for this customer
    const customerConvs = await this.prisma.conversation.findMany({
      where: {
        customerId: customer.id,
        tenantId,
        deletedAt: null
      },
      include: {
        tagLinks: {
          where: { deletedAt: null },
          include: { tag: true }
        },
        internalNotes: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    const tagsMap = new Set<string>();
    for (const c of customerConvs) {
      for (const link of c.tagLinks) {
        if (link.tag && !link.tag.deletedAt) {
          tagsMap.add(link.tag.name);
        }
      }
    }
    const tagsStr = Array.from(tagsMap).join(", ") || "ไม่มี";

    // Notes must ignore soft deleted entries (already handled in where condition)
    const notesList = customerConvs
      .flatMap((c) => c.internalNotes.map((n) => n.body))
      .filter((body) => body.trim().length > 0);
    const notesStr = notesList.join("\n- ") ? `\n- ${notesList.join("\n- ")}` : "ไม่มี";

    // 4. Mapped history text helper
    const conversationHistoryText = history
      .map((msg) => {
        const sender = msg.direction === "INBOUND" ? (customer.displayName || "Customer") : "Agent";
        return `${sender}: ${msg.text || "[Media/Attachment]"}`;
      })
      .join("\n");

    // 5. Load prompt template
    let template = await this.prisma.promptTemplate.findFirst({
      where: {
        tenantId,
        name: "suggested_reply_default"
      }
    });

    if (!template) {
      template = await this.prisma.promptTemplate.findFirst({
        where: {
          tenantId: null,
          name: "suggested_reply_default"
        }
      });
    }

    const systemPromptTemplate = template
      ? template.systemPrompt
      : `คุณเป็นผู้ช่วย Agent ร้านค้าที่กำลังตอบแชทลูกค้าผ่าน LINE OA

{{agent_gender_instruction}}

ชื่อลูกค้า: {{customer_name}}
แท็กลูกค้า: {{tags}}
โน้ตภายในทีม (ข้อมูลสำคัญ ห้ามฝ่าฝืนเด็ดขาด): {{notes}}

ประวัติการสนทนาล่าสุด:
{{conversation_history}}

ข้อความร่างล่าสุดของ Agent:
{{current_draft}}

คำสั่งสำหรับ action_type = {{action_type}}:
- generate: ร่างคำตอบใหม่ สุภาพ กระชับ ตรงประเด็น
- rewrite: เขียนใหม่ข้อความร่างล่าสุดของ Agent ให้ความหมายเดิมแต่สำนวนต่างออกไป
- shorter: ย่อข้อความร่างล่าสุดของ Agent ให้สั้นลงและกระชับขึ้น
- polite: ปรับข้อความร่างล่าสุดของ Agent ให้สุภาพขึ้น
- friendly: ปรับข้อความร่างล่าสุดของ Agent ให้เป็นกันเองขึ้น

ตอบเป็นข้อความเดียวที่พร้อมส่งจริง ไม่ต้องมีคำอธิบายเพิ่มเติม ไม่ต้องใส่ quote`;

    const agentGenderInstruction = buildAgentGenderInstruction(aiAgentGender);

    // 6. Build prompt by replacing placeholders
    const compiledPromptBase = systemPromptTemplate
      .replace("{{agent_gender_instruction}}", agentGenderInstruction)
      .replace("{{customer_name}}", customer.displayName || "ลูกค้า")
      .replace("{{tags}}", tagsStr)
      .replace("{{notes}}", notesStr)
      .replace("{{action_type}}", actionType)
      .replace("{{conversation_history}}", conversationHistoryText)
      .replace("{{current_draft}}", dto.current_text || "ไม่มี");

    const compiledPrompt = systemPromptTemplate.includes("{{agent_gender_instruction}}")
      ? compiledPromptBase
      : `${agentGenderInstruction}\n\n${compiledPromptBase}`;

    const historyForLlm = history.map((msg) => ({
      role: msg.direction === "INBOUND" ? ("customer" as const) : ("agent" as const),
      text: msg.text || ""
    }));

    let suggestionText = "";
    const llmStartedAt = Date.now();
    try {
      const rawSuggestion = await activeLlmClient.generateReply({
        systemPrompt: compiledPrompt,
        conversationHistory: historyForLlm
      });
      suggestionText = normalizeThaiPoliteParticles(rawSuggestion, aiAgentGender);
    } catch (llmError) {
      const errorCode = this.extractLlmErrorCode(llmError);
      await this.logAiSuggestFailure(tenantId, userId, {
        conversationId,
        actionType,
        provider,
        errorCode,
        mode: "suggest"
      });
      throw this.buildLlmHttpException(llmError);
    }
    const latencyMs = Date.now() - llmStartedAt;

    // 7. Save suggestion if LLM succeeded (Addendum 2 requirement: DO NOT save row if LLM call failed)
    if (dto.previous_suggestion_id) {
      await this.prisma.aiSuggestion.updateMany({
        where: {
          id: dto.previous_suggestion_id,
          tenantId
        },
        data: {
          status: "superseded"
        }
      });
    }

    const suggestion = await this.prisma.aiSuggestion.create({
      data: {
        tenantId,
        conversationId,
        actionType,
        promptUsed: compiledPrompt,
        suggestionText,
        status: "shown",
        provider,
        latencyMs
      }
    });

    await this.incrementAiCreditUsage(tenantId);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.AI_SUGGEST_GENERATED,
        targetType: "AiSuggestion",
        targetId: suggestion.id,
        metadata: {
          conversationId,
          actionType,
          provider,
          aiAgentGender,
          latencyMs
        }
      }
    });

    return {
      suggestion_id: suggestion.id,
      suggestion_text: suggestionText
    };
  }

  async getAiUsage(tenantId: string): Promise<AiUsageSnapshot> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planId: true }
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    const limits = await this.prisma.planLimit.findUnique({
      where: { planId: tenant.planId }
    });
    const limit = limits?.maxAiCreditsPerMonth ?? 0;

    const { periodStart, periodEnd } = getCurrentMonthUsagePeriod();
    const counter = await this.prisma.usageCounter.findUnique({
      where: {
        tenantId_metric_periodStart: {
          tenantId,
          metric: AI_SUGGEST_USAGE_METRIC,
          periodStart
        }
      }
    });

    const used = Number(counter?.value ?? 0n);
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: { aiProvider: true }
    });
    const provider = (settings?.aiProvider || process.env.LLM_PROVIDER || "gemini").toLowerCase();

    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      percentage: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0,
      planId: tenant.planId,
      provider,
      providerLabel: this.getProviderLabel(provider),
      modelName: this.getModelNameForProvider(provider),
      creditsAvailable: limit > 0 && used < limit
    };
  }

  async aiTest(tenantId: string, userId: string, dto: AiTestDto): Promise<AiTestResult> {
    const testLimitKey = `ai-test-limit:tenant:${tenantId}`;
    const testCount = await this.redisService.client.incr(testLimitKey);
    if (testCount === 1) {
      await this.redisService.client.expire(testLimitKey, 60);
    }
    if (testCount > 10) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many AI test requests. Please wait before trying again."
          }
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (settings?.enableAiSuggest === false) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: "AI_SUGGEST_DISABLED",
            message: "AI suggestions are disabled for this tenant."
          }
        },
        HttpStatus.FORBIDDEN
      );
    }

    const aiAgentGender = settings?.aiAgentGender ?? AiAgentGender.FEMALE;
    await this.assertAiCreditAvailable(tenantId, userId);

    const provider = (settings?.aiProvider || process.env.LLM_PROVIDER || "gemini").toLowerCase();
    const activeLlmClient = this.resolveLlmClient(provider);
    const sampleMessage = dto.sample_message?.trim() || "สวัสดีครับ มีสินค้าอะไรบ้างคะ";
    const agentGenderInstruction = buildAgentGenderInstruction(aiAgentGender);

    let template = await this.prisma.promptTemplate.findFirst({
      where: {
        tenantId,
        name: "suggested_reply_default"
      }
    });

    if (!template) {
      template = await this.prisma.promptTemplate.findFirst({
        where: {
          tenantId: null,
          name: "suggested_reply_default"
        }
      });
    }

    const systemPromptTemplate = template
      ? template.systemPrompt
      : `คุณเป็นผู้ช่วย Agent ร้านค้าที่กำลังตอบแชทลูกค้าผ่าน LINE OA

{{agent_gender_instruction}}

ชื่อลูกค้า: {{customer_name}}
แท็กลูกค้า: {{tags}}
โน้ตภายในทีม (ข้อมูลสำคัญ ห้ามฝ่าฝืนเด็ดขาด): {{notes}}

ประวัติการสนทนาล่าสุด:
{{conversation_history}}

ข้อความร่างล่าสุดของ Agent:
{{current_draft}}

คำสั่งสำหรับ action_type = {{action_type}}:
- generate: ร่างคำตอบใหม่ สุภาพ กระชับ ตรงประเด็น

ตอบเป็นข้อความเดียวที่พร้อมส่งจริง ไม่ต้องมีคำอธิบายเพิ่มเติม ไม่ต้องใส่ quote`;

    const conversationHistoryText = `ลูกค้าทดสอบ: ${sampleMessage}`;
    const compiledPromptBase = systemPromptTemplate
      .replace("{{agent_gender_instruction}}", agentGenderInstruction)
      .replace("{{customer_name}}", "ลูกค้าทดสอบ")
      .replace("{{tags}}", "ทดสอบ")
      .replace("{{notes}}", "ไม่มี")
      .replace("{{action_type}}", "generate")
      .replace("{{conversation_history}}", conversationHistoryText)
      .replace("{{current_draft}}", "ไม่มี");

    const compiledPrompt = systemPromptTemplate.includes("{{agent_gender_instruction}}")
      ? compiledPromptBase
      : `${agentGenderInstruction}\n\n${compiledPromptBase}`;

    const historyForLlm = [{ role: "customer" as const, text: sampleMessage }];
    const startedAt = Date.now();

    let suggestionText = "";
    try {
      const rawSuggestion = await activeLlmClient.generateReply({
        systemPrompt: compiledPrompt,
        conversationHistory: historyForLlm
      });
      suggestionText = normalizeThaiPoliteParticles(rawSuggestion, aiAgentGender);
    } catch (llmError) {
      const errorCode = this.extractLlmErrorCode(llmError);
      await this.logAiSuggestFailure(tenantId, userId, {
        provider,
        errorCode,
        mode: "test"
      });
      throw this.buildLlmHttpException(llmError);
    }

    const latencyMs = Date.now() - startedAt;

    await this.incrementAiCreditUsage(tenantId);
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.AI_SUGGEST_GENERATED,
        targetType: "AiSuggestion",
        metadata: {
          mode: "test",
          provider,
          aiAgentGender,
          latencyMs
        }
      }
    });

    return {
      suggestion_text: suggestionText,
      provider,
      provider_label: this.getProviderLabel(provider),
      model_name: this.getModelNameForProvider(provider),
      latency_ms: latencyMs
    };
  }

  async updateAiSuggestion(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateAiSuggestionDto
  ) {
    const suggestion = await this.prisma.aiSuggestion.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!suggestion) {
      throw new NotFoundException("AI Suggestion not found");
    }

    const updated = await this.prisma.aiSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: dto.status,
        finalSentText: dto.final_sent_text
      }
    });

    const auditActionByStatus: Partial<Record<string, AuditAction>> = {
      sent: AuditAction.AI_SUGGEST_SENT,
      edited: AuditAction.AI_SUGGEST_EDITED,
      rejected: AuditAction.AI_SUGGEST_REJECTED
    };
    const auditAction = auditActionByStatus[dto.status];
    if (auditAction) {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: auditAction,
          targetType: "AiSuggestion",
          targetId: updated.id,
          metadata: {
            conversationId: suggestion.conversationId,
            status: dto.status,
            finalSentText: dto.final_sent_text ?? null
          }
        }
      });
    }

    return {
      success: true,
      id: updated.id,
      status: updated.status
    };
  }

  async getPromptTemplate(tenantId: string, name: string): Promise<PromptTemplate> {
    let template = await this.prisma.promptTemplate.findFirst({
      where: { tenantId, name }
    });

    if (!template) {
      template = await this.prisma.promptTemplate.findFirst({
        where: { tenantId: null, name }
      });
    }

    if (!template) {
      throw new NotFoundException(`Prompt template ${name} not found`);
    }

    return template;
  }

  async updatePromptTemplate(
    tenantId: string,
    userId: string,
    name: string,
    systemPrompt: string
  ): Promise<PromptTemplate> {
    const template = await this.prisma.promptTemplate.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name
        }
      },
      create: {
        tenantId,
        name,
        systemPrompt
      },
      update: {
        systemPrompt
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.INBOX_SETTINGS_UPDATED,
        targetType: "PromptTemplate",
        targetId: template.id,
        metadata: { name, systemPrompt }
      }
    });

    return template;
  }

  private resolveLlmClient(provider: string): LLMClient {
    const normalized = provider.toLowerCase();
    if (normalized === "openai") {
      return this.openaiClient;
    }
    if (normalized === "claude") {
      return this.claudeClient;
    }
    return this.geminiClient;
  }

  private getProviderLabel(provider: string): string {
    const normalized = provider.toLowerCase();
    if (normalized === "openai") {
      return "OpenAI GPT";
    }
    if (normalized === "claude") {
      return "Anthropic Claude";
    }
    return "Google Gemini";
  }

  private getModelNameForProvider(provider: string): string {
    const normalized = provider.toLowerCase();
    if (normalized === "openai") {
      return process.env.OPENAI_MODEL || "gpt-4o-mini";
    }
    if (normalized === "claude") {
      return process.env.CLAUDE_MODEL || "claude-3-5-haiku-20241022";
    }
    return process.env.GEMINI_MODEL || "gemini-2.5-flash";
  }

  private buildLlmHttpException(llmError: unknown): HttpException {
    const errorMessage = llmError instanceof Error ? llmError.message : String(llmError);
    this.logger.error(`LLM Generation failed: ${errorMessage}`);

    const code = this.extractLlmErrorCode(llmError);
    const messageByCode: Record<string, string> = {
      AI_PROVIDER_NOT_CONFIGURED: "AI provider API key is not configured on the server.",
      AI_PROVIDER_RATE_LIMITED: "AI provider is temporarily busy. Please try again shortly.",
      AI_PROVIDER_TIMEOUT: "AI provider took too long to respond. Please try again.",
      AI_GENERATION_FAILED: "AI generation failed. Please try again."
    };

    return new HttpException(
      {
        success: false,
        error: {
          code,
          message: messageByCode[code] ?? messageByCode.AI_GENERATION_FAILED
        }
      },
      HttpStatus.BAD_GATEWAY
    );
  }

  private extractLlmErrorCode(llmError: unknown): string {
    const errorMessage = llmError instanceof Error ? llmError.message : String(llmError);

    if (/API_KEY is not defined|OPENAI_API_KEY|ANTHROPIC_API_KEY|CLAUDE_API_KEY/i.test(errorMessage)) {
      return "AI_PROVIDER_NOT_CONFIGURED";
    }
    if (/status 429|rate limit|quota/i.test(errorMessage)) {
      return "AI_PROVIDER_RATE_LIMITED";
    }
    if (/timeout|ETIMEDOUT|ECONNRESET/i.test(errorMessage)) {
      return "AI_PROVIDER_TIMEOUT";
    }
    return "AI_GENERATION_FAILED";
  }

  private async logAiSuggestFailure(
    tenantId: string,
    userId: string,
    metadata: Prisma.InputJsonValue
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.AI_SUGGEST_FAILED,
        targetType: "AiSuggestion",
        metadata
      }
    });
  }

  private async assertAiCreditAvailable(tenantId: string, userId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planId: true }
    });

    const limits = tenant
      ? await this.prisma.planLimit.findUnique({
          where: { planId: tenant.planId }
        })
      : null;

    if (!tenant || !limits) {
      throw new NotFoundException("Plan limit not found");
    }

    if (limits.maxAiCreditsPerMonth <= 0) {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: AuditAction.PLAN_LIMIT_EXCEEDED,
          targetType: "AiSuggestion",
          metadata: {
            planId: tenant.planId,
            limit: limits.maxAiCreditsPerMonth,
            metric: AI_SUGGEST_USAGE_METRIC
          }
        }
      });
      throw new PlanLimitExceededException("AI credits are not available on the current plan.", {
        planId: tenant.planId,
        limit: limits.maxAiCreditsPerMonth,
        metric: AI_SUGGEST_USAGE_METRIC
      });
    }

    const { periodStart, periodEnd } = getCurrentMonthUsagePeriod();
    const counter = await this.prisma.usageCounter.findUnique({
      where: {
        tenantId_metric_periodStart: {
          tenantId,
          metric: AI_SUGGEST_USAGE_METRIC,
          periodStart
        }
      }
    });

    const currentUsage = Number(counter?.value ?? 0n);
    if (currentUsage >= limits.maxAiCreditsPerMonth) {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: AuditAction.PLAN_LIMIT_EXCEEDED,
          targetType: "AiSuggestion",
          metadata: {
            planId: tenant.planId,
            limit: limits.maxAiCreditsPerMonth,
            current: currentUsage,
            metric: AI_SUGGEST_USAGE_METRIC,
            periodStart,
            periodEnd
          }
        }
      });
      throw new PlanLimitExceededException("Monthly AI credit limit exceeded.", {
        planId: tenant.planId,
        limit: limits.maxAiCreditsPerMonth,
        current: currentUsage,
        metric: AI_SUGGEST_USAGE_METRIC
      });
    }
  }

  private async incrementAiCreditUsage(tenantId: string): Promise<void> {
    const { periodStart, periodEnd } = getCurrentMonthUsagePeriod();

    await this.prisma.usageCounter.upsert({
      where: {
        tenantId_metric_periodStart: {
          tenantId,
          metric: AI_SUGGEST_USAGE_METRIC,
          periodStart
        }
      },
      create: {
        tenantId,
        metric: AI_SUGGEST_USAGE_METRIC,
        periodStart,
        periodEnd,
        value: 1
      },
      update: {
        value: { increment: 1 },
        periodEnd
      }
    });
  }
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.trunc(value)));
}
