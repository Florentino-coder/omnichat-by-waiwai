import { Body, Controller, Get, Param, Post, Query, UseGuards, Patch } from "@nestjs/common";
import { SuperAdminService } from "./super-admin.service";
import { AiMonitorService } from "./ai-monitor.service";
import { AiQaService } from "../ai/ai-qa.service";
import { BackupService } from "../backup/backup.service";
import { CreateTenantOwnerDto } from "./dto/create-tenant-owner.dto";
import { UpdateTenantPlanDto } from "../tenants/dto/update-tenant-plan.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperOwnerGuard } from "./guards/super-owner.guard";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtTenantPayload } from "../auth/types/auth.types";

@Controller("super-admin")
@UseGuards(JwtAuthGuard, SuperOwnerGuard)
export class SuperAdminController {
  constructor(
    private readonly superAdminService: SuperAdminService,
    private readonly aiMonitorService: AiMonitorService,
    private readonly aiQaService: AiQaService,
    private readonly backupService: BackupService
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

  @Get("ai/qa-summary")
  getAiQaSummary(@Query("from") from?: string, @Query("to") to?: string) {
    return this.aiQaService.getPlatformQaSummary(from, to);
  }

  @Get("ai/tenants/:tenantId/usage")
  getAiTenantUsage(@Param("tenantId") tenantId: string) {
    return this.aiMonitorService.getTenantUsage(tenantId);
  }

  @Get("backups/runs")
  listBackupRuns(@Query("limit") limit?: string) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 50;
    return this.backupService.listRuns(Number.isFinite(parsedLimit) ? parsedLimit : 50);
  }

  @Get("backups/health")
  getBackupHealth() {
    return this.backupService.getHealth();
  }

  @Post("backups/run")
  triggerBackupRun(@TenantCtx() ctx: JwtTenantPayload) {
    return this.backupService.triggerManualBackup(ctx.sub);
  }

  @Patch("tenants/:id/plan")
  updateTenantPlan(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") tenantId: string,
    @Body() dto: UpdateTenantPlanDto
  ) {
    return this.superAdminService.updateTenantPlan(ctx.sub, tenantId, dto.planId);
  }
}
