import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Role, Workspace, WorkspaceMember } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { AdminResetPasswordDto } from "./dto/admin-reset-password.dto";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";
import { WorkspacesService } from "./workspaces.service";

@Controller("workspaces")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  list(@TenantCtx() ctx: JwtTenantPayload): Promise<Workspace[]> {
    return this.workspacesService.list(ctx.tenantId);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: CreateWorkspaceDto
  ): Promise<Workspace> {
    return this.workspacesService.create(ctx.tenantId, ctx.sub, dto);
  }

  @Get(":id")
  get(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<Workspace> {
    return this.workspacesService.get(ctx.tenantId, id);
  }

  @Patch(":id")
  @Roles(Role.ADMIN)
  update(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: UpdateWorkspaceDto
  ): Promise<Workspace> {
    return this.workspacesService.update(ctx.tenantId, id, dto);
  }

  @Delete(":id")
  @Roles(Role.OWNER)
  remove(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<Workspace> {
    return this.workspacesService.softDelete(ctx.tenantId, id);
  }

  @Get(":id/members")
  listMembers(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): ReturnType<WorkspacesService["listMembers"]> {
    return this.workspacesService.listMembers(ctx.tenantId, id);
  }

  @Patch(":id/members/:userId")
  @Roles(Role.ADMIN)
  updateMemberRole(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Param("userId") userId: string,
    @Body() dto: UpdateMemberRoleDto
  ): Promise<WorkspaceMember> {
    return this.workspacesService.updateMemberRole(
      ctx.tenantId,
      id,
      userId,
      dto.role
    );
  }

  @Delete(":id/members/:userId")
  @Roles(Role.ADMIN)
  removeMember(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Param("userId") userId: string
  ): Promise<WorkspaceMember> {
    return this.workspacesService.removeMember(ctx.tenantId, id, userId, ctx.sub);
  }

  @Post(":id/members/:userId/reset-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN)
  resetMemberPassword(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Param("userId") userId: string,
    @Body() dto: AdminResetPasswordDto
  ): Promise<void> {
    return this.workspacesService.resetMemberPassword(
      ctx.tenantId,
      id,
      userId,
      ctx.sub,
      ctx.role,
      dto
    );
  }
}
