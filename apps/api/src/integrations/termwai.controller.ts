import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import {
  ConnectTermwaiDto,
  LookupTermwaiCustomerDto,
  TermwaiOrderParamsDto
} from "./dto/termwai.dto";
import { TermwaiService } from "./termwai.service";

@Controller("integrations/termwai")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class TermwaiController {
  constructor(private readonly termwaiService: TermwaiService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT)
  getStatus(@TenantCtx() ctx: JwtTenantPayload) {
    return this.termwaiService.getStatus(ctx.tenantId);
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  connect(@TenantCtx() ctx: JwtTenantPayload, @Body() dto: ConnectTermwaiDto) {
    return this.termwaiService.connect(ctx.tenantId, ctx.sub, dto.apiKey);
  }

  @Delete()
  @Roles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(@TenantCtx() ctx: JwtTenantPayload) {
    return this.termwaiService.disconnect(ctx.tenantId, ctx.sub);
  }

  @Get("customers")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT)
  lookupCustomers(@TenantCtx() ctx: JwtTenantPayload, @Query() query: LookupTermwaiCustomerDto) {
    return this.termwaiService.lookupCustomers(ctx.tenantId, ctx.sub, query.phone);
  }

  @Get("orders/:orderNumber")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT)
  getOrder(@TenantCtx() ctx: JwtTenantPayload, @Param() params: TermwaiOrderParamsDto) {
    return this.termwaiService.getOrder(ctx.tenantId, ctx.sub, params.orderNumber);
  }
}
