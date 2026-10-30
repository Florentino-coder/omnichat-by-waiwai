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
import { ConnectionsService } from "./connections.service";
import {
  CreateConnectionDto,
  LookupCustomerDto,
  LookupOrderParamsDto
} from "./dto/connection.dto";

@Controller("integrations")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Get("status")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT)
  getStatus(@TenantCtx() ctx: JwtTenantPayload) {
    return this.connectionsService.getStatus(ctx.tenantId);
  }

  @Get("connection")
  @Roles(Role.OWNER, Role.ADMIN)
  getConnection(@TenantCtx() ctx: JwtTenantPayload) {
    return this.connectionsService.getConnection(ctx.tenantId);
  }

  @Post("connection")
  @Roles(Role.OWNER, Role.ADMIN)
  create(@TenantCtx() ctx: JwtTenantPayload, @Body() dto: CreateConnectionDto) {
    return this.connectionsService.create(ctx.tenantId, ctx.sub, dto.name, dto.baseUrl);
  }

  @Post("connection/test")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.ADMIN)
  test(@TenantCtx() ctx: JwtTenantPayload) {
    return this.connectionsService.test(ctx.tenantId, ctx.sub);
  }

  @Post("connection/rotate")
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.ADMIN)
  rotate(@TenantCtx() ctx: JwtTenantPayload) {
    return this.connectionsService.rotateSecret(ctx.tenantId, ctx.sub);
  }

  @Delete("connection")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.OWNER, Role.ADMIN)
  disconnect(@TenantCtx() ctx: JwtTenantPayload) {
    return this.connectionsService.disconnect(ctx.tenantId, ctx.sub);
  }

  @Get("lookup/customers")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT)
  lookupCustomers(@TenantCtx() ctx: JwtTenantPayload, @Query() query: LookupCustomerDto) {
    return this.connectionsService.lookupCustomers(ctx.tenantId, ctx.sub, query.phone);
  }

  @Get("lookup/orders/:orderNumber")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT)
  getOrder(@TenantCtx() ctx: JwtTenantPayload, @Param() params: LookupOrderParamsDto) {
    return this.connectionsService.getOrder(ctx.tenantId, ctx.sub, params.orderNumber);
  }
}
