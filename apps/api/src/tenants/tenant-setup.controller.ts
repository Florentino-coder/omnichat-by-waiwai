import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { Tenant } from "@prisma/client";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { TenantsService } from "./tenants.service";

@Controller("tenants")
@UseGuards(JwtAuthGuard)
export class TenantSetupController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  createTenant(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: CreateTenantDto
  ): Promise<Tenant> {
    return this.tenantsService.createTenant(ctx.sub, dto.name);
  }
}
