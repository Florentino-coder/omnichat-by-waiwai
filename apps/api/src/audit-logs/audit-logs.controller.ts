import { Controller, Get, Header, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { AuditLogsService } from "./audit-logs.service";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";

@Controller("audit-logs")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN)
  async list(@TenantCtx() ctx: JwtTenantPayload, @Query() query: ListAuditLogsQueryDto) {
    const result = await this.auditLogsService.listPaginated(ctx.tenantId, query);
    return {
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    };
  }

  @Get("export")
  @Roles(Role.OWNER)
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="audit-logs.csv"')
  async export(@TenantCtx() ctx: JwtTenantPayload, @Query() query: ListAuditLogsQueryDto) {
    const csv = await this.auditLogsService.exportCsv(ctx.tenantId, query);
    return csv;
  }
}
