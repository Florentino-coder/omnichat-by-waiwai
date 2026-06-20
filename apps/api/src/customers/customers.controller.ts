import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { CustomersService } from "./customers.service";
import { PatchCustomerDto } from "./dto/patch-customer.dto";

@Controller("customers")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get(":id")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT, Role.QC)
  findOne(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ) {
    return this.customersService.findOne(ctx.tenantId, id);
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT)
  update(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: PatchCustomerDto
  ) {
    return this.customersService.update(ctx.tenantId, id, dto);
  }
}
