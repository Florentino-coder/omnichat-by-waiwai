import { Injectable } from "@nestjs/common";
import { AuditLog } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }
}
