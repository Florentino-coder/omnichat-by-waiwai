import { Body, Controller, Get, Param, Patch, Query, UseGuards, Header } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import {
  ListQaScoresQueryDto,
  QaComplianceQueryDto,
  ReviewQaScoreDto
} from "./dto/qa-query.dto";
import { QaService } from "./qa.service";

@Controller("qa")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class QaController {
  constructor(private readonly qaService: QaService) {}

  @Get("scores")
  @Roles(Role.OWNER, Role.ADMIN, Role.QC)
  async listScores(@TenantCtx() ctx: JwtTenantPayload, @Query() query: ListQaScoresQueryDto) {
    const result = await this.qaService.listScores(ctx.tenantId, query);
    return {
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    };
  }

  @Get("scores/:id")
  @Roles(Role.OWNER, Role.ADMIN, Role.QC)
  async getScore(@TenantCtx() ctx: JwtTenantPayload, @Param("id") id: string) {
    const data = await this.qaService.getScoreDetail(ctx.tenantId, id);
    return { success: true, data };
  }

  @Patch("scores/:id/review")
  @Roles(Role.OWNER, Role.ADMIN, Role.QC)
  async reviewScore(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: ReviewQaScoreDto
  ) {
    const data = await this.qaService.reviewScore(
      ctx.tenantId,
      ctx.sub,
      id,
      dto.reviewNote
    );
    return { success: true, data };
  }

  @Get("compliance-summary")
  @Roles(Role.OWNER, Role.ADMIN, Role.QC)
  async complianceSummary(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query() query: QaComplianceQueryDto
  ) {
    const data = await this.qaService.getComplianceSummary(ctx.tenantId, query);
    return { success: true, data };
  }

  @Get("compliance-export")
  @Roles(Role.OWNER)
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="qa-compliance.csv"')
  async complianceExport(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query() query: QaComplianceQueryDto
  ) {
    return this.qaService.exportComplianceCsv(ctx.tenantId, query);
  }
}
