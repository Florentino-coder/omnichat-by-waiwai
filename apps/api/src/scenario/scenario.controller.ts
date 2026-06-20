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
import { AiScenario, Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { CreateAiScenarioDto } from "./dto/create-ai-scenario.dto";
import { ListAiScenariosDto } from "./dto/list-ai-scenarios.dto";
import { UpdateAiScenarioDto } from "./dto/update-ai-scenario.dto";
import { ScenarioService } from "./scenario.service";

@Controller("ai/scenarios")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ScenarioController {
  constructor(private readonly scenarioService: ScenarioService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT, Role.QC, Role.VIEWER)
  listScenarios(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query() query: ListAiScenariosDto
  ): Promise<AiScenario[]> {
    return this.scenarioService.listScenarios(ctx.tenantId, query.lineChannelId);
  }

  @Get(":id")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT, Role.QC, Role.VIEWER)
  findOne(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<AiScenario> {
    return this.scenarioService.findOne(ctx.tenantId, id);
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  createScenario(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: CreateAiScenarioDto
  ): Promise<AiScenario> {
    return this.scenarioService.createScenario(ctx.tenantId, ctx.sub, dto);
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  updateScenario(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: UpdateAiScenarioDto
  ): Promise<AiScenario> {
    return this.scenarioService.updateScenario(
      ctx.tenantId,
      ctx.sub,
      id,
      dto,
      ctx.role
    );
  }

  @Delete(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  deleteScenario(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<AiScenario> {
    return this.scenarioService.deleteScenario(
      ctx.tenantId,
      ctx.sub,
      id,
      ctx.role
    );
  }
}
