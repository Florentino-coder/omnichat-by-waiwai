import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Logger, HttpException, HttpStatus, BadGatewayException } from "@nestjs/common";
import {
  AuditAction,
  AiAgentGender,
  AiAutoReplyMode,
  Conversation,
  ConversationInternalNote,
  ConversationPriority,
  ConversationTag,
  ConversationTagLink,
  Message,
  MessageDirection,
  MessageSource,
  MessageType,
  Prisma,
  Role,
  SavedReply,
  LineChannel,
  WorkspaceMember,
  PromptTemplate,
  AutomationTriggerType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { ConversationStatus } from "./dto/update-conversation-status.dto";
import { RedisService } from "../redis/redis.service";
import { AiReplyGeneratorService } from "../ai/ai-reply-generator.service";
import {
  DEFAULT_AI_AUTO_REPLY_BUSINESS_HOUR_END,
  DEFAULT_AI_AUTO_REPLY_BUSINESS_HOUR_START,
  DEFAULT_AI_AUTO_REPLY_MODE,
  AI_ESCALATED_TAG_NAME,
  DEFAULT_AI_ESCALATION_KEYWORDS,
  normalizeEscalationKeywords,
  resolveEscalationKeywords
} from "../ai/ai-auto-reply.constants";
import {
  buildLlmHttpException,
  extractLlmErrorCode,
  resolveLlmClient
} from "../ai/ai-llm.util";
import { GeminiClient } from "../common/llm/gemini.client";
import { OpenAIClient } from "../common/llm/openai.client";
import { ClaudeClient } from "../common/llm/claude.client";
import { KnowledgeService } from "../knowledge/knowledge.service";
import { ScenarioService } from "../scenario/scenario.service";
import { AutomationService } from "../automation/automation.service";
import { UpdateAiSuggestionDto } from "./dto/update-ai-suggestion.dto";
import { UpdateInboxSettingsDto } from "./dto/update-inbox-settings.dto";
import { AiSuggestDto } from "./dto/ai-suggest.dto";
import { AiTestDto } from "./dto/ai-test.dto";
import { AiSummaryDto } from "./dto/ai-summary.dto";
import type { Response } from "express";
import { Readable } from "stream";
import type { ReadableStream as WebReadableStream } from "stream/web";
import { PlanLimitExceededException } from "../common/exceptions/plan-limit-exceeded.exception";
import {
  AI_SUGGEST_USAGE_METRIC,
  buildAgentGenderInstruction,
  getCurrentMonthUsagePeriod,
  normalizeThaiPoliteParticles,
  formatMessagesForLlm
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
  enableHybridAutoDraft: boolean;
  enableAiScenarios: boolean;
  aiProvider: string;
  aiAgentGender: AiAgentGender;
  enableAiAutoReply: boolean;
  aiAutoReplyMode: AiAutoReplyMode;
  aiAutoReplyBusinessHourStart: number;
  aiAutoReplyBusinessHourEnd: number;
  aiAutoReplyInstructions: string | null;
  aiEscalationKeywords: string[];
  aiAutoReplyConfidenceThreshold: number;
};

export type AiCreditBlockReason = "PLAN_EXCLUDES_AI" | "MONTHLY_LIMIT_REACHED";

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
  blockReason: AiCreditBlockReason | null;
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
  tagName?: string;
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

export type ConversationMessagesPage = {
  messages: Message[];
  hasMore: boolean;
  oldestId: string | null;
};

const LINE_MEDIA_MESSAGE_TYPES: MessageType[] = [
  MessageType.IMAGE,
  MessageType.VIDEO,
  MessageType.AUDIO,
  MessageType.FILE
];

export function resolveMessageMediaUrl(message: Pick<
  Message,
  "id" | "mediaUrl" | "source" | "direction" | "externalMessageId" | "type"
>): string | null {
  const storedMediaUrl = message.mediaUrl?.trim();
  if (storedMediaUrl) {
    return storedMediaUrl;
  }

  const isLineInboundMedia =
    message.source === MessageSource.LINE &&
    message.direction === MessageDirection.INBOUND &&
    message.externalMessageId &&
    LINE_MEDIA_MESSAGE_TYPES.includes(message.type);

  if (isLineInboundMedia) {
    return `/api/v1/inbox/messages/${message.id}/media`;
  }

  return null;
}

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
    private readonly claudeClient: ClaudeClient,
    private readonly knowledgeService: KnowledgeService,
    private readonly scenarioService: ScenarioService,
    private readonly automationService: AutomationService,
    private readonly aiReplyGenerator: AiReplyGeneratorService
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
        deletedAt: null,
        ...(options.tagName
          ? {
              tagLinks: {
                some: {
                  deletedAt: null,
                  tag: {
                    name: options.tagName,
                    deletedAt: null
                  }
                }
              }
            }
          : {})
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

  async countEscalatedConversations(tenantId: string): Promise<{ count: number }> {
    const count = await this.prisma.conversation.count({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        tagLinks: {
          some: {
            deletedAt: null,
            tag: {
              name: AI_ESCALATED_TAG_NAME,
              deletedAt: null
            }
          }
        }
      }
    });

    return { count };
  }

  async getConversationMessages(
    tenantId: string,
    conversationId: string,
    options?: { limit?: number; before?: string }
  ): Promise<ConversationMessagesPage> {
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

    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);

    let cursorCreatedAt: Date | undefined;
    if (options?.before) {
      const cursorMessage = await this.prisma.message.findFirst({
        where: {
          id: options.before,
          tenantId,
          conversationId,
          deletedAt: null
        },
        select: { createdAt: true }
      });

      if (!cursorMessage) {
        throw new NotFoundException("Message not found");
      }

      cursorCreatedAt = cursorMessage.createdAt;
    }

    const fetched = await this.prisma.message.findMany({
      where: {
        tenantId,
        conversationId,
        deletedAt: null,
        ...(cursorCreatedAt ? { createdAt: { lt: cursorCreatedAt } } : {})
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1
    });

    const hasMore = fetched.length > limit;
    const page = hasMore ? fetched.slice(0, limit) : fetched;
    const messages = page.reverse().map((message) => ({
      ...message,
      mediaUrl: resolveMessageMediaUrl(message)
    }));

    return {
      messages,
      hasMore,
      oldestId: messages.length > 0 ? messages[0].id : null
    };
  }

  async streamMessageMedia(tenantId: string, messageId: string, res: Response): Promise<void> {
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        tenantId,
        deletedAt: null
      },
      include: {
        lineChannel: {
          select: {
            encryptedChannelAccessToken: true
          }
        }
      }
    });

    if (!message) {
      throw new NotFoundException("Message not found");
    }

    if (!LINE_MEDIA_MESSAGE_TYPES.includes(message.type)) {
      throw new BadRequestException("Message is not a media type");
    }

    if (!message.externalMessageId) {
      throw new BadRequestException("Message has no external media reference");
    }

    if (!message.lineChannel?.encryptedChannelAccessToken) {
      throw new BadGatewayException("LINE channel access token is unavailable");
    }

    const accessToken = this.cryptoSecret.decrypt(message.lineChannel.encryptedChannelAccessToken);
    const lineResponse = await fetch(
      `https://api-data.line.me/v2/bot/message/${message.externalMessageId}/content`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (lineResponse.status === 404) {
      throw new NotFoundException("Media not found");
    }

    if (!lineResponse.ok) {
      throw new BadGatewayException("Failed to fetch media from LINE");
    }

    const contentType = lineResponse.headers.get("content-type") ?? "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");

    const contentLength = lineResponse.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    if (!lineResponse.body) {
      res.status(502).end();
      return;
    }

    res.status(lineResponse.status);
    Readable.fromWeb(lineResponse.body as WebReadableStream<Uint8Array>).pipe(res);
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

  async getUnrepliedInboundCount(tenantId: string, conversationId: string): Promise<number> {
    await this.findTenantConversation(tenantId, conversationId);

    const lastOutbound = await this.prisma.message.findFirst({
      where: {
        tenantId,
        conversationId,
        direction: MessageDirection.OUTBOUND,
        deletedAt: null
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    });

    return this.prisma.message.count({
      where: {
        tenantId,
        conversationId,
        direction: MessageDirection.INBOUND,
        deletedAt: null,
        ...(lastOutbound ? { createdAt: { gt: lastOutbound.createdAt } } : {})
      }
    });
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

    await this.automationService
      .dispatchEvent(
        tenantId,
        conversation.id,
        AutomationTriggerType.STATUS_CHANGED,
        { status }
      )
      .catch((error: unknown) => {
        this.logger.error(
          "Failed to dispatch STATUS_CHANGED automation",
          error instanceof Error ? error.stack : error
        );
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

    await this.automationService
      .dispatchEvent(
        tenantId,
        conversation.id,
        AutomationTriggerType.TAG_ADDED,
        { addedTagName: tag.name }
      )
      .catch((error: unknown) => {
        this.logger.error(
          "Failed to dispatch TAG_ADDED automation",
          error instanceof Error ? error.stack : error
        );
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
        enableHybridAutoDraft: true,
        enableAiScenarios: true,
        aiProvider: true,
        aiAgentGender: true,
        enableAiAutoReply: true,
        aiAutoReplyMode: true,
        aiAutoReplyBusinessHourStart: true,
        aiAutoReplyBusinessHourEnd: true,
        aiAutoReplyInstructions: true,
        aiEscalationKeywords: true,
        aiAutoReplyConfidenceThreshold: true
      }
    });

    return {
      inProgressAlertMinutes: settings?.inProgressAlertMinutes ?? 10,
      enableAiSuggest: settings?.enableAiSuggest ?? true,
      enableHybridAutoDraft: settings?.enableHybridAutoDraft ?? true,
      enableAiScenarios: settings?.enableAiScenarios ?? true,
      aiProvider: settings?.aiProvider ?? "gemini",
      aiAgentGender: settings?.aiAgentGender ?? AiAgentGender.FEMALE,
      enableAiAutoReply: settings?.enableAiAutoReply ?? false,
      aiAutoReplyMode: settings?.aiAutoReplyMode ?? DEFAULT_AI_AUTO_REPLY_MODE,
      aiAutoReplyBusinessHourStart:
        settings?.aiAutoReplyBusinessHourStart ?? DEFAULT_AI_AUTO_REPLY_BUSINESS_HOUR_START,
      aiAutoReplyBusinessHourEnd:
        settings?.aiAutoReplyBusinessHourEnd ?? DEFAULT_AI_AUTO_REPLY_BUSINESS_HOUR_END,
      aiAutoReplyInstructions: settings?.aiAutoReplyInstructions ?? null,
      aiEscalationKeywords: resolveEscalationKeywords(settings?.aiEscalationKeywords),
      aiAutoReplyConfidenceThreshold: settings?.aiAutoReplyConfidenceThreshold ?? 0.80
    };
  }

  async updateSettings(
    tenantId: string,
    userId: string,
    dto: UpdateInboxSettingsDto
  ): Promise<InboxSettings> {
    const normalizedEscalationKeywords =
      dto.aiEscalationKeywords !== undefined
        ? normalizeEscalationKeywords(dto.aiEscalationKeywords)
        : undefined;

    const settings = await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        inProgressAlertMinutes: dto.inProgressAlertMinutes ?? 10,
        enableAiSuggest: dto.enableAiSuggest ?? true,
        enableHybridAutoDraft: dto.enableHybridAutoDraft ?? true,
        enableAiScenarios: dto.enableAiScenarios ?? true,
        aiProvider: dto.aiProvider ?? "gemini",
        aiAgentGender: dto.aiAgentGender ?? AiAgentGender.FEMALE,
        enableAiAutoReply: dto.enableAiAutoReply ?? false,
        aiAutoReplyMode: dto.aiAutoReplyMode ?? DEFAULT_AI_AUTO_REPLY_MODE,
        aiAutoReplyBusinessHourStart:
          dto.aiAutoReplyBusinessHourStart ?? DEFAULT_AI_AUTO_REPLY_BUSINESS_HOUR_START,
        aiAutoReplyBusinessHourEnd:
          dto.aiAutoReplyBusinessHourEnd ?? DEFAULT_AI_AUTO_REPLY_BUSINESS_HOUR_END,
        aiAutoReplyInstructions: dto.aiAutoReplyInstructions ?? null,
        aiEscalationKeywords:
          normalizedEscalationKeywords ?? [...DEFAULT_AI_ESCALATION_KEYWORDS],
        aiAutoReplyConfidenceThreshold: dto.aiAutoReplyConfidenceThreshold ?? 0.80
      },
      update: {
        inProgressAlertMinutes: dto.inProgressAlertMinutes,
        enableAiSuggest: dto.enableAiSuggest,
        enableHybridAutoDraft: dto.enableHybridAutoDraft,
        enableAiScenarios: dto.enableAiScenarios,
        aiProvider: dto.aiProvider,
        aiAgentGender: dto.aiAgentGender,
        enableAiAutoReply: dto.enableAiAutoReply,
        aiAutoReplyMode: dto.aiAutoReplyMode,
        aiAutoReplyBusinessHourStart: dto.aiAutoReplyBusinessHourStart,
        aiAutoReplyBusinessHourEnd: dto.aiAutoReplyBusinessHourEnd,
        aiAutoReplyInstructions: dto.aiAutoReplyInstructions,
        aiEscalationKeywords: normalizedEscalationKeywords,
        aiAutoReplyConfidenceThreshold: dto.aiAutoReplyConfidenceThreshold
      },
      select: {
        inProgressAlertMinutes: true,
        enableAiSuggest: true,
        enableHybridAutoDraft: true,
        enableAiScenarios: true,
        aiProvider: true,
        aiAgentGender: true,
        enableAiAutoReply: true,
        aiAutoReplyMode: true,
        aiAutoReplyBusinessHourStart: true,
        aiAutoReplyBusinessHourEnd: true,
        aiAutoReplyInstructions: true,
        aiEscalationKeywords: true,
        aiAutoReplyConfidenceThreshold: true
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
          enableHybridAutoDraft: dto.enableHybridAutoDraft,
          enableAiScenarios: dto.enableAiScenarios,
          aiProvider: dto.aiProvider,
          aiAgentGender: dto.aiAgentGender,
          enableAiAutoReply: dto.enableAiAutoReply,
          aiAutoReplyMode: dto.aiAutoReplyMode,
          aiAutoReplyBusinessHourStart: dto.aiAutoReplyBusinessHourStart,
          aiAutoReplyBusinessHourEnd: dto.aiAutoReplyBusinessHourEnd,
          aiAutoReplyInstructions: dto.aiAutoReplyInstructions,
          aiEscalationKeywords: normalizedEscalationKeywords
        }
      }
    });

    if (dto.enableHybridAutoDraft === false) {
      await this.prisma.aiSuggestion.updateMany({
        where: {
          tenantId,
          status: "shown",
          isProgrammatic: true
        },
        data: {
          status: "superseded"
        }
      });
    }

    return {
      inProgressAlertMinutes: settings.inProgressAlertMinutes,
      enableAiSuggest: settings.enableAiSuggest,
      enableHybridAutoDraft: settings.enableHybridAutoDraft,
      enableAiScenarios: settings.enableAiScenarios,
      aiProvider: settings.aiProvider,
      aiAgentGender: settings.aiAgentGender,
      enableAiAutoReply: settings.enableAiAutoReply,
      aiAutoReplyMode: settings.aiAutoReplyMode,
      aiAutoReplyBusinessHourStart: settings.aiAutoReplyBusinessHourStart,
      aiAutoReplyBusinessHourEnd: settings.aiAutoReplyBusinessHourEnd,
      aiAutoReplyInstructions: settings.aiAutoReplyInstructions,
      aiEscalationKeywords: resolveEscalationKeywords(settings.aiEscalationKeywords),
      aiAutoReplyConfidenceThreshold: settings.aiAutoReplyConfidenceThreshold
    };
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

    if (actionType !== "generate" && !dto.current_text?.trim()) {
      throw new BadRequestException("Current text is required for tone refinement actions");
    }

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

    const generateResult = await this.aiReplyGenerator.generate({
      tenantId,
      conversationId,
      userId,
      actionType,
      currentText: dto.current_text,
      aiAgentGender,
      provider,
      applyScenarioActions: true,
      includeConfidence: actionType === "generate"
    });

    if (generateResult.outcome === "knowledge_only") {
      await this.logAiSuggestFailure(tenantId, userId, {
        conversationId,
        actionType,
        provider: generateResult.provider,
        errorCode: generateResult.errorCode,
        mode: "knowledge_only"
      });

      return {
        mode: "knowledge_only" as const,
        suggestion_id: null,
        suggestion_text: null,
        knowledge_citations: generateResult.knowledgeCitations
      };
    }

    if (generateResult.outcome === "llm_failed") {
      await this.logAiSuggestFailure(tenantId, userId, {
        conversationId,
        actionType,
        provider: generateResult.provider,
        errorCode: generateResult.errorCode,
        mode: "suggest"
      });
      throw buildLlmHttpException(generateResult.llmError);
    }

    const { suggestionText, compiledPrompt, knowledgeCitations, latencyMs, confidence } = generateResult;

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
        latencyMs,
        citations: knowledgeCitations as any,
        confidence: confidence ?? null
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
      mode: "llm" as const,
      suggestion_id: suggestion.id,
      suggestion_text: suggestionText,
      knowledge_citations: knowledgeCitations
    };
  }

  async getConversationSummary(
    tenantId: string,
    userId: string,
    conversationId: string,
    dto: AiSummaryDto
  ): Promise<{ summary: string }> {
    // 1. Fetch conversation
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

    // 2. Validate customer details
    if (!conversation.customerId || !conversation.customer || conversation.customer.deletedAt !== null) {
      throw new NotFoundException("Customer not found or has been deleted");
    }

    // 3. Get latest 15 messages first to handle empty fallback without charges or rate-limiting
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        tenantId,
        deletedAt: null
      },
      orderBy: { createdAt: "desc" },
      take: 15
    });

    const targetLocale = dto.locale === "en" ? "en" : "th";

    if (messages.length === 0) {
      const fallback = targetLocale === "en" ? "No conversation history to summarize" : "ไม่มีประวัติการสนทนาสำหรับสรุป";
      return { summary: fallback };
    }

    // 4. Assert settings and AI suggests enabled
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

    // 5. Assert credit availability
    await this.assertAiCreditAvailable(tenantId, userId);

    // 6. Rate-limit via Redis (conversation & tenant level)
    const conversationLimitKey = `ai-summary-limit:conversation:${conversationId}`;
    const tenantLimitKey = `ai-summary-limit:tenant:${tenantId}`;

    const [convCount, tenantCount] = await Promise.all([
      this.redisService.client.incr(conversationLimitKey),
      this.redisService.client.incr(tenantLimitKey)
    ]);

    if (convCount === 1) {
      await this.redisService.client.expire(conversationLimitKey, 60);
    }
    if (tenantCount === 1) {
      await this.redisService.client.expire(tenantLimitKey, 60);
    }

    if (convCount > 5 || tenantCount > 30) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many AI summaries requested. Please wait before trying again."
          }
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const history = messages.reverse();
    const historyForLlm = formatMessagesForLlm(history);

    const provider = (settings?.aiProvider || process.env.LLM_PROVIDER || "gemini").toLowerCase();
    const activeLlmClient = resolveLlmClient(provider, {
      gemini: this.geminiClient,
      openai: this.openaiClient,
      claude: this.claudeClient
    });

    const promptByLocale: Record<string, string> = {
      th: `คุณเป็นผู้ช่วยสรุปบทสนทนาของร้านค้าทาง LINE OA
สรุปบทสนทนาระหว่างร้านค้าและลูกค้าตามประวัติการสนทนาที่กำหนดให้เป็นภาษาไทยสั้นๆ:
- สรุปประเด็นหลักและความต้องการของลูกค้า
- จัดหมวดหมู่ประเด็น (เช่น สอบถามราคา, ปัญหาการใช้งาน, ขอข้อมูลเพิ่มเติม)
- เขียนเป็นข้อความสรุปกระชับ 3-4 บรรทัด หรือหัวข้อสั้นๆ
- ห้ามใส่น้ำเสียงประจบหรือข้อความต้อนรับใดๆ เข้าเรื่องสรุปทันที`,
      en: `You are an AI assistant summarizing a LINE OA merchant-customer chat.
Summarize the conversation history between the merchant and the customer in English:
- Highlight key points and customer needs.
- Categorize the issues (e.g., pricing inquiry, technical issue, request for info).
- Write a concise summary of 3-4 bullet points.
- Do not include greetings or polite fillers; get straight to the summary.`
    };

    const systemPrompt = promptByLocale[targetLocale];

    try {
      const summary = await activeLlmClient.generateReply({
        systemPrompt,
        conversationHistory: historyForLlm
      });

      // 6. Increment AI usage and audit log
      await this.incrementAiCreditUsage(tenantId);

      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: AuditAction.AI_CONVERSATION_SUMMARIZED,
          targetType: "Conversation",
          targetId: conversationId,
          metadata: {
            provider,
            locale: targetLocale,
            messageCount: messages.length
          }
        }
      });

      return { summary };
    } catch (llmError) {
      throw buildLlmHttpException(llmError);
    }
  }

  async getActiveSuggestion(
    tenantId: string,
    conversationId: string
  ): Promise<{
    suggestion_id: string | null;
    suggestion_text: string | null;
    knowledge_citations: any[];
    confidence?: number | null;
    confidence_threshold?: number;
  }> {
    const [settings, conversation] = await Promise.all([
      this.prisma.tenantSettings.findUnique({
        where: { tenantId },
        select: { aiAutoReplyConfidenceThreshold: true, enableHybridAutoDraft: true }
      }),
      this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          tenantId,
          deletedAt: null
        },
        select: { status: true }
      })
    ]);

    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const enableHybridAutoDraft = settings?.enableHybridAutoDraft ?? true;

    const activeSuggestion = await this.prisma.aiSuggestion.findFirst({
      where: {
        conversationId,
        tenantId,
        status: "shown",
        ...(enableHybridAutoDraft ? {} : { isProgrammatic: false })
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        suggestionText: true,
        citations: true,
        confidence: true,
        createdAt: true
      }
    });

    const confidenceThreshold = settings?.aiAutoReplyConfidenceThreshold ?? 0.80;

    if (!activeSuggestion) {
      return {
        suggestion_id: null,
        suggestion_text: null,
        knowledge_citations: [],
        confidence: null,
        confidence_threshold: confidenceThreshold
      };
    }

    const latestMessage = await this.prisma.message.findFirst({
      where: {
        conversationId,
        tenantId,
        deletedAt: null
      },
      orderBy: { createdAt: "desc" },
      select: { direction: true, createdAt: true }
    });

    const agentRepliedAfterSuggestion =
      latestMessage?.direction === MessageDirection.OUTBOUND &&
      latestMessage.createdAt >= activeSuggestion.createdAt;

    if (agentRepliedAfterSuggestion) {
      return {
        suggestion_id: null,
        suggestion_text: null,
        knowledge_citations: [],
        confidence: null,
        confidence_threshold: confidenceThreshold
      };
    }

    const isResolved = conversation.status === "RESOLVED";

    return {
      suggestion_id: activeSuggestion.id,
      suggestion_text: isResolved ? null : activeSuggestion.suggestionText,
      knowledge_citations: (activeSuggestion.citations as any) || [],
      confidence: activeSuggestion.confidence,
      confidence_threshold: confidenceThreshold
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
    const blockReason: AiCreditBlockReason | null =
      limit <= 0 ? "PLAN_EXCLUDES_AI" : used >= limit ? "MONTHLY_LIMIT_REACHED" : null;

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
      creditsAvailable: blockReason === null,
      blockReason
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
    const activeLlmClient = resolveLlmClient(provider, {
      gemini: this.geminiClient,
      openai: this.openaiClient,
      claude: this.claudeClient
    });
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

ข้อมูลจาก Knowledge Base (ใช้เป็นข้อมูลอ้างอิง ห้ามแต่งเพิ่ม):
{{knowledge_context}}

คำสั่ง Scenario ที่ match (ให้ความสำคัญสูงกว่าคำสั่งทั่วไป):
{{scenario_instructions}}

ประวัติการสนทนาล่าสุด:
{{conversation_history}}

ข้อความร่างล่าสุดของ Agent:
{{current_draft}}

คำสั่งสำหรับ action_type = {{action_type}}:
- generate: ร่างคำตอบใหม่ สุภาพ กระชับ ตรงประเด็น

ตอบเป็นข้อความเดียวที่พร้อมส่งจริง ไม่ต้องมีคำอธิบายเพิ่มเติม ไม่ต้องใส่ quote`;

    const conversationHistoryText = `ลูกค้าทดสอบ: ${sampleMessage}`;
    const knowledgeContext = await this.knowledgeService.buildKnowledgeContext(
      tenantId,
      sampleMessage
    );
    const scenarioMatch = await this.scenarioService.buildScenarioInstructions(
      tenantId,
      sampleMessage,
      []
    );
    const scenarioInstructions = scenarioMatch.instructions;
    const compiledPromptBase = systemPromptTemplate
      .replace("{{agent_gender_instruction}}", agentGenderInstruction)
      .replace("{{customer_name}}", "ลูกค้าทดสอบ")
      .replace("{{tags}}", "ทดสอบ")
      .replace("{{notes}}", "ไม่มี")
      .replace("{{knowledge_context}}", knowledgeContext)
      .replace("{{scenario_instructions}}", scenarioInstructions)
      .replace("{{action_type}}", "generate")
      .replace("{{conversation_history}}", conversationHistoryText)
      .replace("{{current_draft}}", "ไม่มี");

    const promptWithKnowledge = systemPromptTemplate.includes("{{knowledge_context}}")
      ? compiledPromptBase
      : `${compiledPromptBase}\n\nข้อมูลจาก Knowledge Base (ใช้เป็นข้อมูลอ้างอิง ห้ามแต่งเพิ่ม):\n${knowledgeContext}`;

    const promptWithScenario = systemPromptTemplate.includes("{{scenario_instructions}}")
      ? promptWithKnowledge
      : `${promptWithKnowledge}\n\nคำสั่ง Scenario ที่ match:\n${scenarioInstructions}`;

    const compiledPrompt = systemPromptTemplate.includes("{{agent_gender_instruction}}")
      ? promptWithScenario
      : `${agentGenderInstruction}\n\n${promptWithScenario}`;

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
      const errorCode = extractLlmErrorCode(llmError);
      await this.logAiSuggestFailure(tenantId, userId, {
        provider,
        errorCode,
        mode: "test"
      });
      throw buildLlmHttpException(llmError);
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
        metric: AI_SUGGEST_USAGE_METRIC,
        reason: "PLAN_EXCLUDES_AI"
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
        metric: AI_SUGGEST_USAGE_METRIC,
        reason: "MONTHLY_LIMIT_REACHED"
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
