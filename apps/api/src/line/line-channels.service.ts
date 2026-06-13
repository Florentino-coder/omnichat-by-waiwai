import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, LineChannel } from "@prisma/client";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConnectLineChannelDto } from "./dto/connect-line-channel.dto";

@Injectable()
export class LineChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoSecret: CryptoSecretService
  ) {}

  list(tenantId: string): Promise<LineChannel[]> {
    return this.prisma.lineChannel.findMany({
      where: {
        tenantId,
        deletedAt: null
      },
      orderBy: { createdAt: "asc" }
    });
  }

  async connect(
    tenantId: string,
    userId: string,
    dto: ConnectLineChannelDto
  ): Promise<LineChannel> {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: dto.workspaceId,
        tenantId,
        deletedAt: null
      }
    });

    if (!workspace) {
      throw new BadRequestException("Workspace not found for tenant");
    }

    const channel = await this.prisma.lineChannel.create({
      data: {
        tenantId,
        workspaceId: dto.workspaceId,
        name: dto.name,
        badgeColor: dto.badgeColor,
        lineChannelId: dto.lineChannelId,
        encryptedChannelSecret: this.cryptoSecret.encrypt(dto.channelSecret),
        encryptedChannelAccessToken: this.cryptoSecret.encrypt(dto.channelAccessToken),
        tokenExpiresAt: dto.tokenExpiresAt ? new Date(dto.tokenExpiresAt) : undefined
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.LINE_CHANNEL_CONNECTED,
        targetType: "LineChannel",
        targetId: channel.id,
        metadata: {
          workspaceId: dto.workspaceId,
          lineChannelId: dto.lineChannelId
        }
      }
    });

    return channel;
  }

  async getTenantChannel(tenantId: string, id: string): Promise<LineChannel> {
    const channel = await this.prisma.lineChannel.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null
      }
    });

    if (!channel) {
      throw new NotFoundException("LINE channel not found");
    }

    return channel;
  }
}
