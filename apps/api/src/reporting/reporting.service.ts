import { BadRequestException, Injectable } from "@nestjs/common";
import { MessageDirection } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDateRange(fromStr?: string, toStr?: string) {
    let toDate: Date;
    let fromDate: Date;

    if (toStr) {
      toDate = new Date(`${toStr}T23:59:59.999Z`);
    } else {
      toDate = new Date();
      toDate.setUTCHours(23, 59, 59, 999);
    }

    if (fromStr) {
      fromDate = new Date(`${fromStr}T00:00:00.000Z`);
    } else {
      fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      fromDate.setUTCHours(0, 0, 0, 0);
    }

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException("Invalid date format. Use ISO 8601 YYYY-MM-DD.");
    }

    if (fromDate > toDate) {
      throw new BadRequestException("Start date ('from') cannot be after end date ('to').");
    }

    const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 90) {
      throw new BadRequestException("Date range cannot exceed 90 days.");
    }

    return { fromDate, toDate };
  }

  async getSummary(tenantId: string, from?: string, to?: string) {
    const { fromDate, toDate } = this.parseDateRange(from, to);

    const [
      totalConversations,
      activeConversations,
      resolvedConversations,
      totalMessages,
      inboundMessages,
      outboundMessages,
    ] = await Promise.all([
      // Total conversations created in range
      this.prisma.conversation.count({
        where: {
          tenantId,
          createdAt: { gte: fromDate, lte: toDate },
          deletedAt: null,
        },
      }),
      // Active conversations created in range
      this.prisma.conversation.count({
        where: {
          tenantId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
          createdAt: { gte: fromDate, lte: toDate },
          deletedAt: null,
        },
      }),
      // Resolved conversations resolved/updated in range
      this.prisma.conversation.count({
        where: {
          tenantId,
          status: { in: ["RESOLVED", "CLOSED"] },
          updatedAt: { gte: fromDate, lte: toDate },
          deletedAt: null,
        },
      }),
      // Total messages in range
      this.prisma.message.count({
        where: {
          tenantId,
          createdAt: { gte: fromDate, lte: toDate },
          deletedAt: null,
        },
      }),
      // Inbound messages in range
      this.prisma.message.count({
        where: {
          tenantId,
          direction: MessageDirection.INBOUND,
          createdAt: { gte: fromDate, lte: toDate },
          deletedAt: null,
        },
      }),
      // Outbound messages in range
      this.prisma.message.count({
        where: {
          tenantId,
          direction: MessageDirection.OUTBOUND,
          createdAt: { gte: fromDate, lte: toDate },
          deletedAt: null,
        },
      }),
    ]);

    return {
      totalConversations,
      activeConversations,
      resolvedConversations,
      totalMessages,
      inboundMessages,
      outboundMessages,
    };
  }

  async getCharts(tenantId: string, from?: string, to?: string) {
    const { fromDate, toDate } = this.parseDateRange(from, to);

    // 1. Daily Message Volume
    const messages = await this.prisma.message.findMany({
      where: {
        tenantId,
        createdAt: { gte: fromDate, lte: toDate },
        deletedAt: null,
      },
      select: {
        createdAt: true,
        direction: true,
      },
    });

    const volumeMap = new Map<string, { inbound: number; outbound: number }>();
    const current = new Date(fromDate.getTime());
    while (current <= toDate) {
      const dateStr = current.toISOString().split("T")[0];
      volumeMap.set(dateStr, { inbound: 0, outbound: 0 });
      current.setUTCDate(current.getUTCDate() + 1);
    }

    for (const msg of messages) {
      const dateStr = msg.createdAt.toISOString().split("T")[0];
      const counts = volumeMap.get(dateStr);
      if (counts) {
        if (msg.direction === MessageDirection.INBOUND) {
          counts.inbound++;
        } else {
          counts.outbound++;
        }
      }
    }

    const dailyMessageVolume = Array.from(volumeMap.entries()).map(([date, counts]) => ({
      date,
      inbound: counts.inbound,
      outbound: counts.outbound,
    }));

    // 2. Tag Distribution (links created in range)
    const tagLinks = await this.prisma.conversationTagLink.findMany({
      where: {
        tenantId,
        createdAt: { gte: fromDate, lte: toDate },
        deletedAt: null,
      },
      select: {
        tagId: true,
      },
    });

    const tagCountsMap = new Map<string, number>();
    for (const link of tagLinks) {
      tagCountsMap.set(link.tagId, (tagCountsMap.get(link.tagId) ?? 0) + 1);
    }

    const tags = await this.prisma.conversationTag.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        color: true,
      },
    });

    const tagDistribution = tags
      .map((tag) => ({
        name: tag.name,
        color: tag.color,
        count: tagCountsMap.get(tag.id) ?? 0,
      }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count);

    // 3. Agent Workload (Active Open/In-progress conversations created in range per agent)
    const activeConvs = await this.prisma.conversation.findMany({
      where: {
        tenantId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        createdAt: { gte: fromDate, lte: toDate },
        deletedAt: null,
      },
      select: {
        assignedToMemberId: true,
      },
    });

    const workloadMap = new Map<string, number>();
    for (const conv of activeConvs) {
      const assigneeId = conv.assignedToMemberId ?? "unassigned";
      workloadMap.set(assigneeId, (workloadMap.get(assigneeId) ?? 0) + 1);
    }

    const members = await this.prisma.workspaceMember.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            displayName: true,
          },
        },
      },
    });

    const agentWorkload = Array.from(workloadMap.entries()).map(([assigneeId, count]) => {
      if (assigneeId === "unassigned") {
        return {
          agentName: "ยังไม่มีผู้รับผิดชอบ",
          count,
        };
      }
      const member = members.find((m) => m.id === assigneeId);
      return {
        agentName: member?.user?.displayName ?? "Unknown Agent",
        count,
      };
    });

    return {
      dailyMessageVolume,
      tagDistribution,
      agentWorkload,
    };
  }
}
