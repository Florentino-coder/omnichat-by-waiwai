import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { SuperAdminService } from "./super-admin.service";
import { CreateTenantOwnerDto } from "./dto/create-tenant-owner.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuperOwnerGuard } from "./guards/super-owner.guard";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtTenantPayload } from "../auth/types/auth.types";

@Controller("super-admin")
@UseGuards(JwtAuthGuard, SuperOwnerGuard)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

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
}
