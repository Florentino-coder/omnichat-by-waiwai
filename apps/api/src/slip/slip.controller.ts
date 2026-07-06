import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { SlipService } from "./slip.service";

@Controller("slip")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class SlipController {
  constructor(private readonly slipService: SlipService) {}

  @Get("verifications")
  @Roles(Role.OWNER, Role.ADMIN)
  async getVerifications(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query("lineChannelId") lineChannelId?: string,
    @Query("verifyStatus") verifyStatus?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    const pageNum = Math.max(1, parseInt(page || "1", 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || "20", 10)));
    const offset = (pageNum - 1) * limitNum;

    return this.slipService.getVerifications(ctx.tenantId, {
      lineChannelId,
      verifyStatus: verifyStatus?.trim() || undefined,
      dateFrom: dateFrom?.trim() || undefined,
      dateTo: dateTo?.trim() || undefined,
      search: search?.trim() || undefined,
      offset,
      limit: limitNum,
    });
  }
}
