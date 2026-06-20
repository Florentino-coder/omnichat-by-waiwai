import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { SuperAdminService } from "./super-admin.service";
import { AiMonitorService } from "./ai-monitor.service";
import { CreateTenantOwnerDto } from "./dto/create-tenant-owner.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperOwnerGuard } from "./guards/super-owner.guard";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtTenantPayload } from "../auth/types/auth.types";

@Controller("super-admin")
@UseGuards(JwtAuthGuard, SuperOwnerGuard)
export class SuperAdminController {
  constructor(
    private readonly superAdminService: SuperAdminService,
    private readonly aiMonitorService: AiMonitorService
  ) {}

  @Get("tenants")
  listTenants() {
    return this.superAdminService.listTenants();
  }

  @Post("tenants")
  createTenant(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: CreateTenantOwnerDto
  ) {
    return this.superAdminService.createTenantWithOwner(ctx.sub, dto);
  }

  @Get("ai/stats")
  getAiStats() {
    return this.aiMonitorService.getStats();
  }

  @Get("ai/slowest")
  getAiSlowest(@Query("limit") limit?: string) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 20;
    return this.aiMonitorService.getSlowest(Number.isFinite(parsedLimit) ? parsedLimit : 20);
  }

  @Get("ai/health")
  getAiHealth() {
    return this.aiMonitorService.getHealth();
  }

  @Get("ai/tenants/:tenantId/usage")
  getAiTenantUsage(@Param("tenantId") tenantId: string) {
    return this.aiMonitorService.getTenantUsage(tenantId);
  }
}
