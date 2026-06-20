import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { AutomationRule, Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import {
  CreateAutomationRuleDto,
  ListAutomationRulesDto,
  UpdateAutomationRuleDto
} from "./dto/automation-rule.dto";
import { AutomationService } from "./automation.service";

@Controller("automation/rules")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT, Role.QC, Role.VIEWER)
  listRules(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query() query: ListAutomationRulesDto
  ): Promise<AutomationRule[]> {
    return this.automationService.listRules(ctx.tenantId, query.lineChannelId);
  }

  @Get(":id")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT, Role.QC, Role.VIEWER)
  findOne(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<AutomationRule> {
    return this.automationService.findOne(ctx.tenantId, id);
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  createRule(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: CreateAutomationRuleDto
  ): Promise<AutomationRule> {
    return this.automationService.createRule(ctx.tenantId, ctx.sub, dto);
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  updateRule(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: UpdateAutomationRuleDto
  ): Promise<AutomationRule> {
    return this.automationService.updateRule(
      ctx.tenantId,
      ctx.sub,
      id,
      dto,
      ctx.role
    );
  }

  @Delete(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  deleteRule(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<AutomationRule> {
    return this.automationService.deleteRule(
      ctx.tenantId,
      ctx.sub,
      id,
      ctx.role
    );
  }
}
