import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { GetReportingQueryDto } from "./dto/reporting.dto";
import { ReportingService } from "./reporting.service";

@Controller("reporting")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get("summary")
  @Roles(Role.OWNER, Role.ADMIN, Role.QC, Role.VIEWER)
  async getSummary(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query() query: GetReportingQueryDto,
  ) {
    const summary = await this.reportingService.getSummary(
      ctx.tenantId,
      query.from,
      query.to,
    );
    return {
      success: true,
      data: summary,
    };
  }

  @Get("charts")
  @Roles(Role.OWNER, Role.ADMIN, Role.QC, Role.VIEWER)
  async getCharts(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query() query: GetReportingQueryDto,
  ) {
    const chartsData = await this.reportingService.getCharts(
      ctx.tenantId,
      query.from,
      query.to,
    );
    return {
      success: true,
      data: chartsData,
    };
  }

  @Get("ai-summary")
  @Roles(Role.OWNER, Role.ADMIN, Role.QC, Role.VIEWER)
  async getAiSummary(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query() query: GetReportingQueryDto
  ) {
    const data = await this.reportingService.getAiSummary(
      ctx.tenantId,
      query.from,
      query.to
    );
    return {
      success: true,
      data
    };
  }

  @Get("ai-qa-summary")
  @Roles(Role.OWNER, Role.ADMIN, Role.QC, Role.VIEWER)
  async getAiQaSummary(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query() query: GetReportingQueryDto
  ) {
    const data = await this.reportingService.getAiQaSummary(
      ctx.tenantId,
      query.from,
      query.to
    );
    return {
      success: true,
      data
    };
  }
}
