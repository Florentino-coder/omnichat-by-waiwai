import { Body, Controller, Post, UseGuards, ForbiddenException } from "@nestjs/common";
import { Tenant } from "@prisma/client";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { TenantsService } from "./tenants.service";

@Controller("tenants")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantSetupController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  async createTenant(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: CreateTenantDto
  ): Promise<Tenant> {
    const hasOwner = await this.tenantsService.hasOwnerMembership(ctx.sub);
    if (!hasOwner) {
      throw new ForbiddenException("Only owners can create tenants");
    }
    return this.tenantsService.createTenant(ctx.sub, dto.name);
  }
}
