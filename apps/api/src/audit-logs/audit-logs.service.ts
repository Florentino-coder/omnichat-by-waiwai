import { BadRequestException, Injectable } from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { actionsForCategory, isAuditLogCategory } from "./audit-action-categories";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";

const EXPORT_MAX_ROWS = 10_000;

export type AuditLogActor = {
  id: string;
  displayName: string;
  email: string;
} | null;

export type AuditLogListItem = {
  id: string;
  action: AuditAction;
  targetType: string | null;
  targetId: string | null;
  metadata: Prisma.JsonValue | null;
  ipAddress: string | null;
  createdAt: Date;
  actor: AuditLogActor;
};

export type AuditLogListResult = {
  items: AuditLogListItem[];
  page: number;
  limit: number;
  total: number;
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListAuditLogsQueryDto = {}): Promise<AuditLogListItem[]> {
    const result = await this.listPaginated(tenantId, query);
    return result.items;
  }

  async listPaginated(
    tenantId: string,
    query: ListAuditLogsQueryDto = {}
  ): Promise<AuditLogListResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where = this.buildWhere(tenantId, query);

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true
            }
          }
        }
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return {
      items: rows.map((row) => this.toListItem(row)),
      page,
      limit,
      total
    };
  }

  async exportCsv(tenantId: string, query: ListAuditLogsQueryDto = {}): Promise<string> {
    const where = this.buildWhere(tenantId, query);
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_MAX_ROWS,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        }
      }
    });

    const header = ["createdAt", "action", "actorEmail", "actorName", "targetType", "targetId", "metadata"];
    const lines = [header.join(",")];

    for (const row of rows) {
      const item = this.toListItem(row);
      lines.push(
        [
          item.createdAt.toISOString(),
          item.action,
          item.actor?.email ?? "",
          item.actor?.displayName ?? "system",
          item.targetType ?? "",
          item.targetId ?? "",
          this.escapeCsv(JSON.stringify(item.metadata ?? {}))
        ].join(",")
      );
    }

    return lines.join("\n");
  }

  private buildWhere(tenantId: string, query: ListAuditLogsQueryDto): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = { tenantId };

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = query.action;
    } else if (query.category && isAuditLogCategory(query.category)) {
      where.action = { in: actionsForCategory(query.category) };
    }

    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) {
      const fromDate = new Date(`${query.from}T00:00:00.000Z`);
      if (Number.isNaN(fromDate.getTime())) {
        throw new BadRequestException("Invalid from date");
      }
      createdAt.gte = fromDate;
    }
    if (query.to) {
      const toDate = new Date(`${query.to}T23:59:59.999Z`);
      if (Number.isNaN(toDate.getTime())) {
        throw new BadRequestException("Invalid to date");
      }
      createdAt.lte = toDate;
    }
    if (query.from || query.to) {
      where.createdAt = createdAt;
    }

    return where;
  }

  private toListItem(row: {
    id: string;
    action: AuditAction;
    targetType: string | null;
    targetId: string | null;
    metadata: Prisma.JsonValue | null;
    ipAddress: string | null;
    createdAt: Date;
    user: { id: string; displayName: string; email: string } | null;
  }): AuditLogListItem {
    return {
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      metadata: row.metadata,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt,
      actor: row.user
        ? {
            id: row.user.id,
            displayName: row.user.displayName,
            email: row.user.email
          }
        : null
    };
  }

  private escapeCsv(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
