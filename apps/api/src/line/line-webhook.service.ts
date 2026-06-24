import { Inject, Injectable, Logger, NotFoundException, forwardRef } from "@nestjs/common";
import {
  AuditAction,
  MessageDirection,
  MessageSource,
  MessageType
} from "@prisma/client";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { MonitorService } from "../monitor/monitor.service";
import { ScenarioService } from "../scenario/scenario.service";
import { AutomationService } from "../automation/automation.service";
import { AutomationTriggerType } from "@prisma/client";
import { AiAutoReplyService } from "../ai/ai-auto-reply.service";
import { AiHybridDraftService } from "../ai/ai-hybrid-draft.service";

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
    markAsReadToken?: string;
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
  private readonly logger = new Logger(LineWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoSecret: CryptoSecretService,
    private readonly realtimeService?: RealtimeService,
    private readonly monitorService?: MonitorService,
    private readonly scenarioService?: ScenarioService,
    @Inject(forwardRef(() => AutomationService))
    private readonly automationService?: AutomationService,
    private readonly aiAutoReplyService?: AiAutoReplyService,
    private readonly aiHybridDraftService?: AiHybridDraftService
  ) { }

  async getChannelSecret(lineChannelId: string): Promise<string> {
    const channel = await this.prisma.lineChannel.findUnique({
      where: { lineChannelId }
    });

    if (channel && (channel.deletedAt !== null || !channel.isActive)) {
      throw new NotFoundException("LINE channel not found");
    }

    if (!channel) {
      throw new NotFoundException("LINE channel not found");
    }

    return this.cryptoSecret.decrypt(channel.encryptedChannelSecret);
  }

  async process(lineChannelId: string, payload: LineWebhookPayload, flowId?: string): Promise<void> {
    const channel = await this.prisma.lineChannel.findUnique({
      where: { lineChannelId }
    });

    if (!channel || channel.deletedAt !== null || !channel.isActive) {
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

      if (flowId && this.monitorService) {
        await this.monitorService.recordEvent(flowId, "DB_SAVE_START");
      }

      // Try to find the conversation first to see if we already have the displayName and pictureUrl
      const existingConv = await this.prisma.conversation.findUnique({
        where: {
          tenantId_source_lineChannelId_externalThreadId: {
            tenantId: channel.tenantId,
            source: MessageSource.LINE,
            lineChannelId: channel.id,
            externalThreadId
          }
        },
        select: {
          id: true,
          displayName: true,
          pictureUrl: true
        }
      });

      let lineProfile: LineProfile | undefined;
      if (!existingConv || !existingConv.displayName || !existingConv.pictureUrl) {
        lineProfile = await this.loadLineProfile(channel.encryptedChannelAccessToken, event);
      }

      const customerId = await this.getOrCreateCustomerForLineChannel(
        channel.tenantId,
        externalThreadId,
        lineProfile
      );

      const eventTime = event.timestamp ? new Date(event.timestamp) : new Date();
      const existingConversation = await this.prisma.conversation.findFirst({
        where: {
          tenantId: channel.tenantId,
          source: MessageSource.LINE,
          lineChannelId: channel.id,
          externalThreadId,
          deletedAt: null
        }
      });
      const isNewConversation = !existingConversation;

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
          pictureUrl: lineProfile?.pictureUrl,
          lastMessageAt: eventTime,
          customerId
        },
        update: {
          ...(lineProfile ? { displayName: lineProfile.displayName, pictureUrl: lineProfile.pictureUrl } : {}),
          lastMessageAt: eventTime,
          customerId,
          ...(existingConversation?.status === "RESOLVED"
            ? { status: "OPEN", inProgressStartedAt: null }
            : {})
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
          markAsReadToken: event.message?.markAsReadToken,
          rawPayload: lineProfile ? { ...event, lineProfile } : event,
          sentAt: eventTime
        },
        update: {
          markAsReadToken: event.message?.markAsReadToken,
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

      if (flowId && this.monitorService) {
        await this.monitorService.recordEvent(flowId, "DB_SAVE_END");
        await this.monitorService.recordEvent(flowId, "REDIS_PUBLISH_START");
      }

      await this.realtimeService?.publishTenantEvent(channel.tenantId, "message.created", {
        conversationId: conversation.id,
        messageId: message.id,
        lineChannelId: channel.id,
        direction: MessageDirection.INBOUND
      }, flowId);

      if (
        this.scenarioService &&
        process.env.DISABLE_AI_SCENARIOS !== "true" &&
        messageType === MessageType.TEXT &&
        lineMessage.text?.trim()
      ) {
        await this.scenarioService
          .processInboundMessage(
            channel.tenantId,
            conversation.id,
            lineMessage.text,
            channel.id
          )
          .catch((error: unknown) => {
            this.logger.error(
              "Failed to process AI scenario for inbound message",
              error instanceof Error ? error.stack : error
            );
          });
      }

      if (this.automationService) {
        if (isNewConversation) {
          await this.automationService
            .dispatchEvent(
              channel.tenantId,
              conversation.id,
              AutomationTriggerType.CONVERSATION_CREATED,
              { lineChannelId: channel.id }
            )
            .catch((error: unknown) => {
              this.logger.error(
                "Failed to dispatch CONVERSATION_CREATED automation",
                error instanceof Error ? error.stack : error
              );
            });
        }

        let resumedRuleIds: string[] = [];
        const isTextMessage = messageType === MessageType.TEXT && lineMessage.text?.trim();

        const resumedRuleIdsResult = await this.automationService
          .resumeWaitingRuns(channel.tenantId, conversation.id, message.id)
          .catch((error: unknown) => {
            this.logger.error(
              "Failed to resume waiting automation runs",
              error instanceof Error ? error.stack : error
            );
            return [] as string[];
          });
        if (resumedRuleIdsResult) {
          resumedRuleIds = resumedRuleIdsResult;
        }

        if (isTextMessage) {
          await this.automationService
            .dispatchEvent(
              channel.tenantId,
              conversation.id,
              AutomationTriggerType.MESSAGE_RECEIVED,
              {
                lineChannelId: channel.id,
                messageText: lineMessage.text,
                skipRuleIds: resumedRuleIds
              }
            )
            .catch((error: unknown) => {
              this.logger.error(
                "Failed to dispatch MESSAGE_RECEIVED automation",
                error instanceof Error ? error.stack : error
              );
            });

          await this.automationService
            .dispatchEvent(
              channel.tenantId,
              conversation.id,
              AutomationTriggerType.OFF_HOURS,
              {
                lineChannelId: channel.id,
                messageText: lineMessage.text,
                skipRuleIds: resumedRuleIds
              }
            )
            .catch((error: unknown) => {
              this.logger.error(
                "Failed to dispatch OFF_HOURS automation",
                error instanceof Error ? error.stack : error
              );
            });

          if (this.aiAutoReplyService) {
            const autoReplyResult = await this.aiAutoReplyService
              .tryAutoReply({
                tenantId: channel.tenantId,
                conversationId: conversation.id,
                inboundMessageId: message.id,
                messageText: lineMessage.text ?? ""
              })
              .catch((error: unknown) => {
                this.logger.error(
                  "Failed to process AI auto-reply for inbound message",
                  error instanceof Error ? error.stack : error
                );
                return { outcome: "failed" as const, reason: "error" };
              });

            const shouldTriggerHybrid =
              autoReplyResult.outcome === "skipped" &&
              (autoReplyResult.reason === "disabled" || autoReplyResult.reason === "mode_blocked");

            if (shouldTriggerHybrid && this.aiHybridDraftService) {
              const settings = await this.prisma.tenantSettings.findUnique({
                where: { tenantId: channel.tenantId }
              });
              if (settings?.enableHybridAutoDraft && settings?.enableAiSuggest) {
                await this.aiHybridDraftService
                  .tryHybridDraft(
                    channel.tenantId,
                    conversation.id,
                    message.id,
                    lineMessage.text ?? ""
                  )
                  .catch((err) =>
                    this.logger.error("Failed to trigger background auto-draft suggestion", err)
                  );
              }
            }
          }
        }
      }

      if (flowId && this.monitorService) {
        await this.monitorService.recordEvent(flowId, "REDIS_PUBLISH_END");
      }
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

    const customerId = await this.getOrCreateCustomerForLineChannel(
      channel.tenantId,
      externalThreadId,
      lineProfile
    );

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
        pictureUrl: lineProfile?.pictureUrl,
        lastMessageAt: eventTime,
        status: "OPEN",
        customerId
      },
      update: {
        displayName: lineProfile?.displayName,
        pictureUrl: lineProfile?.pictureUrl,
        lastMessageAt: eventTime,
        deletedAt: null,
        customerId
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

  private async getOrCreateCustomerForLineChannel(
    tenantId: string,
    externalThreadId: string,
    lineProfile?: LineProfile
  ): Promise<string> {
    const existingChannel = await this.prisma.customerChannel.findFirst({
      where: {
        tenantId,
        channelType: "line",
        channelUserId: externalThreadId
      },
      include: {
        customer: true
      }
    });

    if (existingChannel) {
      if (existingChannel.customer && existingChannel.customer.deletedAt === null) {
        if (lineProfile) {
          await this.prisma.customer.update({
            where: { id: existingChannel.customerId },
            data: {
              displayName: lineProfile.displayName,
              avatarUrl: lineProfile.pictureUrl || undefined
            }
          });
        }
        return existingChannel.customerId;
      } else {
        // Customer was soft-deleted! We must delete the old CustomerChannel first
        // to avoid unique constraint violations on @@unique([tenantId, channelType, channelUserId])
        await this.prisma.customerChannel.delete({
          where: { id: existingChannel.id }
        });
      }
    }

    const customer = await this.prisma.customer.create({
      data: {
        tenantId,
        displayName: lineProfile?.displayName || "LINE User",
        avatarUrl: lineProfile?.pictureUrl || null,
        channels: {
          create: {
            tenantId,
            channelType: "line",
            channelUserId: externalThreadId
          }
        }
      }
    });

    return customer.id;
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
