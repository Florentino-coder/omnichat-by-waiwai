import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { getCurrentMonthUsagePeriod } from "../inbox/thai-speech.util";
import { PrismaService } from "../prisma/prisma.service";

const MAX_LISTED_CONNECTIONS = 200;

export type IntegrationAdminRow = {
  id: string;
  tenantId: string;
  tenantName: string;
  planId: string;
  name: string;
  baseUrl: string;
  keyId: string;
  lastTestedAt: Date | null;
  lastTestOk: boolean;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  lookupsThisMonth: number;
};

// Platform view across tenants. Secrets are never selected here, and lookup
// results are never stored, so this console cannot expose either.
@Injectable()
export class IntegrationsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<IntegrationAdminRow[]> {
    const connections = await this.prisma.integrationConnection.findMany({
      // Suspended rows stay listed after a disconnect, or they could never be resumed.
      where: { OR: [{ deletedAt: null }, { suspendedAt: { not: null } }] },
      orderBy: { createdAt: "desc" },
      take: MAX_LISTED_CONNECTIONS,
      select: {
        id: true,
        tenantId: true,
        name: true,
        baseUrl: true,
        keyId: true,
        lastTestedAt: true,
        lastTestOk: true,
        suspendedAt: true,
        suspendedReason: true,
        deletedAt: true,
        createdAt: true,
        tenant: { select: { name: true, planId: true } }
      }
    });

    const { periodStart } = getCurrentMonthUsagePeriod();
    const usage = await this.prisma.auditLog.groupBy({
      by: ["tenantId"],
      where: {
        action: AuditAction.INTEGRATION_LOOKUP,
        createdAt: { gte: periodStart },
        tenantId: { in: connections.map((connection) => connection.tenantId) }
      },
      _count: { _all: true }
    });
    const lookupsByTenant = new Map(usage.map((row) => [row.tenantId, row._count._all]));

    return connections.map(({ tenant, ...connection }) => ({
      ...connection,
      tenantName: tenant.name,
      planId: tenant.planId,
      lookupsThisMonth: lookupsByTenant.get(connection.tenantId) ?? 0
    }));
  }

  async suspend(superOwnerId: string, id: string, reason: string): Promise<void> {
    const connection = await this.findConnection(id);
    if (connection.suspendedAt) {
      throw new ConflictException("Connection is already suspended");
    }

    const suspendedReason = reason.trim();
    await this.prisma.integrationConnection.update({
      where: { id },
      data: { suspendedAt: new Date(), suspendedReason }
    });
    await this.audit(superOwnerId, connection, AuditAction.INTEGRATION_SUSPENDED, {
      reason: suspendedReason
    });
  }

  async resume(superOwnerId: string, id: string): Promise<void> {
    const connection = await this.findConnection(id);
    if (!connection.suspendedAt) {
      throw new ConflictException("Connection is not suspended");
    }

    await this.prisma.integrationConnection.update({
      where: { id },
      data: { suspendedAt: null, suspendedReason: null }
    });
    await this.audit(superOwnerId, connection, AuditAction.INTEGRATION_RESUMED, {});
  }

  private async findConnection(id: string) {
    const connection = await this.prisma.integrationConnection.findUnique({
      where: { id },
      select: { id: true, tenantId: true, keyId: true, suspendedAt: true }
    });
    if (!connection) {
      throw new NotFoundException("Connection not found");
    }
    return connection;
  }

  private async audit(
    superOwnerId: string,
    connection: { id: string; tenantId: string; keyId: string },
    action: AuditAction,
    metadata: Record<string, string>
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: connection.tenantId,
        userId: superOwnerId,
        action,
        targetType: "IntegrationConnection",
        targetId: connection.id,
        metadata: { keyId: connection.keyId, ...metadata }
      }
    });
  }
}
