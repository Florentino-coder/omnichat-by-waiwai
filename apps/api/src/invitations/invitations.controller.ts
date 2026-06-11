import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Invitation, Role, User } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { InvitationsService } from "./invitations.service";
import { CreatedInvitationResponse, InvitationWithContext } from "./types/invitation.types";

@Controller("invitations")
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  create(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: CreateInvitationDto
  ): Promise<CreatedInvitationResponse> {
    return this.invitationsService.create(ctx.tenantId, ctx.sub, dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  list(@TenantCtx() ctx: JwtTenantPayload): Promise<Invitation[]> {
    return this.invitationsService.list(ctx.tenantId);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  revoke(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<Invitation> {
    return this.invitationsService.revoke(ctx.tenantId, id);
  }

  @Get("verify/:token")
  verify(@Param("token") token: string): Promise<InvitationWithContext> {
    return this.invitationsService.verify(token);
  }

  @Post("accept/:token")
  accept(
    @Param("token") token: string,
    @Body() dto: AcceptInvitationDto
  ): Promise<User> {
    return this.invitationsService.accept(token, dto);
  }
}
