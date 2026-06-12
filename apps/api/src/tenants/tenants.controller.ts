import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { Role, Tenant, TenantSettings } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { UpdateTenantPlanDto } from "./dto/update-tenant-plan.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { UpdateTenantSettingsDto } from "./dto/update-tenant-settings.dto";
import { TenantPlanSnapshot, TenantsService } from "./tenants.service";

@Controller("tenants")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get("me")
  getCurrentTenant(@TenantCtx() ctx: JwtTenantPayload): Promise<Tenant> {
    return this.tenantsService.getTenant(ctx.tenantId);
  }

  @Patch("me")
  @Roles(Role.ADMIN)
  updateCurrentTenant(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: UpdateTenantDto
  ): Promise<Tenant> {
    return this.tenantsService.updateTenant(ctx.tenantId, dto);
  }

  @Get("me/settings")
  @Roles(Role.ADMIN)
  getSettings(@TenantCtx() ctx: JwtTenantPayload): Promise<TenantSettings> {
    return this.tenantsService.getSettings(ctx.tenantId);
  }

  @Patch("me/settings")
  @Roles(Role.ADMIN)
  updateSettings(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: UpdateTenantSettingsDto
  ): Promise<TenantSettings> {
    return this.tenantsService.updateSettings(ctx.tenantId, dto);
  }

  @Get("me/plan")
  @Roles(Role.ADMIN)
  getPlan(@TenantCtx() ctx: JwtTenantPayload): Promise<TenantPlanSnapshot> {
    return this.tenantsService.getPlan(ctx.tenantId);
  }

  @Patch("me/plan")
  @Roles(Role.OWNER)
  updatePlan(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: UpdateTenantPlanDto
  ): Promise<TenantPlanSnapshot> {
    return this.tenantsService.updatePlan(ctx.tenantId, ctx.sub, dto);
  }
}
