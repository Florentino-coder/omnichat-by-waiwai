import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { AiCurationService } from "./ai-curation.service";
import { ApproveAiTrainingPairDto, ListAiCurationDto, UpdateAiTrainingPairDto } from "./dto/ai-curation.dto";

@Controller("ai/curation")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AiCurationController {
  constructor(private readonly curationService: AiCurationService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.QC)
  async listPairs(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query() query: ListAiCurationDto,
  ) {
    const result = await this.curationService.listPairs(ctx.tenantId, query);
    return {
      success: true,
      data: {
        items: result.items,
        total: result.total,
      },
    };
  }

  @Get("export")
  @Roles(Role.OWNER, Role.ADMIN, Role.QC)
  async exportPairs(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const result = await this.curationService.exportPairs(ctx.tenantId, status, from, to);
    return {
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        limit: result.limit,
      },
    };
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN, Role.QC)
  async updatePair(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: UpdateAiTrainingPairDto,
  ) {
    const updated = await this.curationService.updatePair(ctx.tenantId, id, dto);
    return {
      success: true,
      data: updated,
    };
  }

  @Post(":id/approve")
  @Roles(Role.OWNER, Role.ADMIN, Role.QC)
  async approvePair(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: ApproveAiTrainingPairDto,
  ) {
    const article = await this.curationService.approvePair(ctx.tenantId, ctx.sub, id, dto);
    return {
      success: true,
      data: article,
    };
  }

  @Delete(":id")
  @Roles(Role.OWNER, Role.ADMIN, Role.QC)
  async deletePair(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
  ) {
    const deleted = await this.curationService.softDeletePair(ctx.tenantId, id);
    return {
      success: true,
      data: deleted,
    };
  }
}
