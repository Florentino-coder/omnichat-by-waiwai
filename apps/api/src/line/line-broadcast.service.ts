import { ConflictException, Injectable, NotFoundException, Logger } from "@nestjs/common";
import { AuditAction, BroadcastStatus, BroadcastType, Prisma } from "@prisma/client";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PrismaService } from "../prisma/prisma.service";
import { BroadcastLineMessageDto, MulticastLineMessageDto } from "./dto/broadcast-line-message.dto";

@Injectable()
export class LineBroadcastService {
  private readonly logger = new Logger(LineBroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoSecret: CryptoSecretService
  ) {}

  async createBroadcast(
    tenantId: string,
    userId: string,
    channelId: string,
    dto: BroadcastLineMessageDto
  ) {
    const channel = await this.prisma.lineChannel.findFirst({
      where: { id: channelId, tenantId, deletedAt: null, isActive: true }
    });
    if (!channel) {
      throw new NotFoundException("LINE channel not found");
    }

    const messages = this.buildLineMessages(dto.text, dto.imageUrl);
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;

    const job = await this.prisma.broadcastJob.create({
      data: {
        tenantId,
        lineChannelId: channelId,
        createdByUserId: userId,
        type: BroadcastType.BROADCAST,
        status: BroadcastStatus.PENDING,
        messages: messages as any,
        scheduledAt
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.LINE_BROADCAST_SCHEDULED,
        targetType: "BroadcastJob",
        targetId: job.id,
        metadata: {
          lineChannelId: channelId,
          scheduledAt: scheduledAt?.toISOString() || "IMMEDIATE"
        }
      }
    });

    // If scheduledAt is not set or is in the past/very near future (e.g. now), send immediately inline
    if (!scheduledAt || scheduledAt.getTime() <= Date.now()) {
      await this.executeBroadcastJob(job.id);
    }

    return this.prisma.broadcastJob.findUnique({ where: { id: job.id } });
  }

  async createMulticast(
    tenantId: string,
    userId: string,
    channelId: string,
    dto: MulticastLineMessageDto
  ) {
    const channel = await this.prisma.lineChannel.findFirst({
      where: { id: channelId, tenantId, deletedAt: null, isActive: true }
    });
    if (!channel) {
      throw new NotFoundException("LINE channel not found");
    }

    const messages = this.buildLineMessages(dto.text, dto.imageUrl);
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;

    const job = await this.prisma.broadcastJob.create({
      data: {
        tenantId,
        lineChannelId: channelId,
        createdByUserId: userId,
        type: BroadcastType.MULTICAST,
        status: BroadcastStatus.PENDING,
        recipientCount: dto.to.length,
        messages: {
          to: dto.to,
          messages
        } as any,
        scheduledAt
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.LINE_BROADCAST_SCHEDULED,
        targetType: "BroadcastJob",
        targetId: job.id,
        metadata: {
          lineChannelId: channelId,
          type: "MULTICAST",
          recipientCount: dto.to.length,
          scheduledAt: scheduledAt?.toISOString() || "IMMEDIATE"
        }
      }
    });

    if (!scheduledAt || scheduledAt.getTime() <= Date.now()) {
      await this.executeBroadcastJob(job.id);
    }

    return this.prisma.broadcastJob.findUnique({ where: { id: job.id } });
  }

  async executeBroadcastJob(jobId: string): Promise<void> {
    const claim = await this.prisma.broadcastJob.updateMany({
      where: {
        id: jobId,
        status: BroadcastStatus.PENDING,
        deletedAt: null
      },
      data: { status: BroadcastStatus.PROCESSING }
    });

    if (claim.count === 0) {
      return;
    }

    const job = await this.prisma.broadcastJob.findUnique({
      where: { id: jobId },
      include: { lineChannel: true }
    });

    if (!job) {
      return;
    }

    try {
      const token = this.cryptoSecret.decrypt(job.lineChannel.encryptedChannelAccessToken);

      if (job.type === BroadcastType.BROADCAST) {
        const response = await fetch("https://api.line.me/v2/bot/message/broadcast", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messages: job.messages
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`LINE broadcast API error: ${response.status} - ${errText}`);
        }

        await this.prisma.broadcastJob.update({
          where: { id: jobId },
          data: {
            status: BroadcastStatus.SENT,
            sentAt: new Date()
          }
        });

        await this.prisma.auditLog.create({
          data: {
            tenantId: job.tenantId,
            userId: job.createdByUserId,
            action: AuditAction.LINE_BROADCAST_SENT,
            targetType: "BroadcastJob",
            targetId: jobId,
            metadata: {
              lineChannelId: job.lineChannelId
            }
          }
        });
      } else if (job.type === BroadcastType.MULTICAST) {
        const payload = job.messages as any;
        const to = payload.to || [];
        const messages = payload.messages || [];

        // LINE multicast API limit is 500 recipients. Chunk if necessary.
        const chunkSize = 500;
        for (let i = 0; i < to.length; i += chunkSize) {
          const chunkTo = to.slice(i, i + chunkSize);
          const response = await fetch("https://api.line.me/v2/bot/message/multicast", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              to: chunkTo,
              messages
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`LINE multicast API error: ${response.status} - ${errText}`);
          }
        }

        await this.prisma.broadcastJob.update({
          where: { id: jobId },
          data: {
            status: BroadcastStatus.SENT,
            sentAt: new Date()
          }
        });

        await this.prisma.auditLog.create({
          data: {
            tenantId: job.tenantId,
            userId: job.createdByUserId,
            action: AuditAction.LINE_MULTICAST_SENT,
            targetType: "BroadcastJob",
            targetId: jobId,
            metadata: {
              lineChannelId: job.lineChannelId,
              recipientCount: to.length
            }
          }
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to execute broadcast job ${jobId}: ${errorMessage}`);

      await this.prisma.broadcastJob.update({
        where: { id: jobId },
        data: {
          status: BroadcastStatus.FAILED,
          errorMessage
        }
      });
    }
  }

  async getBroadcastJobs(tenantId: string, channelId: string) {
    return this.prisma.broadcastJob.findMany({
      where: {
        tenantId,
        lineChannelId: channelId,
        deletedAt: null
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async deleteBroadcastJob(
    tenantId: string,
    channelId: string,
    jobId: string,
    userId: string
  ): Promise<void> {
    const job = await this.prisma.broadcastJob.findFirst({
      where: {
        id: jobId,
        tenantId,
        lineChannelId: channelId,
        deletedAt: null
      }
    });

    if (!job) {
      throw new NotFoundException("Broadcast job not found");
    }

    const now = Date.now();
    const isScheduledPending =
      job.status === BroadcastStatus.PENDING &&
      job.scheduledAt !== null &&
      job.scheduledAt.getTime() > now;

    if (isScheduledPending) {
      await this.softDeleteBroadcastJob(jobId);
      await this.logBroadcastAuditBestEffort({
        tenantId,
        userId,
        action: AuditAction.LINE_BROADCAST_CANCELLED,
        targetId: jobId,
        metadata: {
          lineChannelId: channelId,
          scheduledAt: job.scheduledAt?.toISOString()
        }
      });
      return;
    }

    if (job.status === BroadcastStatus.FAILED) {
      await this.softDeleteBroadcastJob(jobId);
      await this.logBroadcastAuditBestEffort({
        tenantId,
        userId,
        action: AuditAction.LINE_BROADCAST_DELETED,
        targetId: jobId,
        metadata: {
          lineChannelId: channelId,
          status: job.status
        }
      });
      return;
    }

    if (job.status === BroadcastStatus.SENT) {
      throw new ConflictException("Broadcast has already been sent and cannot be cancelled");
    }

    if (job.status === BroadcastStatus.PROCESSING) {
      throw new ConflictException("Broadcast is currently being sent and cannot be cancelled");
    }

    throw new ConflictException("This broadcast cannot be cancelled or deleted");
  }

  private async softDeleteBroadcastJob(jobId: string): Promise<void> {
    await this.prisma.broadcastJob.update({
      where: { id: jobId },
      data: { deletedAt: new Date() }
    });
  }

  private async logBroadcastAuditBestEffort(params: {
    tenantId: string;
    userId: string;
    action: AuditAction;
    targetId: string;
    metadata: Prisma.InputJsonValue;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          action: params.action,
          targetType: "BroadcastJob",
          targetId: params.targetId,
          metadata: params.metadata
        }
      });
    } catch (error) {
      this.logger.warn(
        `Failed to write broadcast audit log (${params.action}) for job ${params.targetId}`,
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  private buildLineMessages(text?: string, imageUrl?: string) {
    const messages = [];
    if (text) {
      messages.push({
        type: "text",
        text
      });
    }
    if (imageUrl) {
      messages.push({
        type: "image",
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl
      });
    }
    return messages;
  }
}
