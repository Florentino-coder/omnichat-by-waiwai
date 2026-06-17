import { Controller, Get, Delete, Param, UseGuards } from "@nestjs/common";
import { StorageService } from "./storage.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { PrismaService } from "../prisma/prisma.service";

@Controller("storage")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService
  ) {}

  @Get("stats")
  @Roles(Role.OWNER, Role.ADMIN)
  async getStats(@TenantCtx() ctx: JwtTenantPayload) {
    return this.storageService.getStats(ctx.tenantId || "");
  }

  @Get("files")
  @Roles(Role.OWNER, Role.ADMIN)
  async listFiles(@TenantCtx() ctx: JwtTenantPayload) {
    return this.prisma.file.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
  }

  @Delete("files/:id")
  @Roles(Role.OWNER, Role.ADMIN)
  async deleteFile(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ) {
    await this.storageService.deleteFile(ctx.tenantId || "", id);
    return { success: true };
  }
}
