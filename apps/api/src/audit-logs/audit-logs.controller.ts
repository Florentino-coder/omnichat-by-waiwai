import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuditLog, Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { AuditLogsService } from "./audit-logs.service";

@Controller("audit-logs")
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  list(@TenantCtx() ctx: JwtTenantPayload): Promise<AuditLog[]> {
    return this.auditLogsService.list(ctx.tenantId);
  }
}
