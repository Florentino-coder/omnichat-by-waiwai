import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { Conversation, Message, Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { RenameCustomerDto } from "./dto/rename-customer.dto";
import { UpdateConversationStatusDto } from "./dto/update-conversation-status.dto";
import { UpdateInboxSettingsDto } from "./dto/update-inbox-settings.dto";
import { InboxConversation, InboxService, InboxSettings } from "./inbox.service";

@Controller("inbox")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InboxController {
  constructor(private readonly inboxService: InboxService) { }

  @Get("conversations")
  @Roles(Role.ADMIN, Role.AGENT, Role.QC)
  listConversations(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ): Promise<InboxConversation[]> {
    return this.inboxService.listConversations(ctx.tenantId, {
      limit: readPositiveInt(limit),
      offset: readPositiveInt(offset)
    });
  }

  @Get("settings")
  @Roles(Role.ADMIN, Role.AGENT, Role.QC)
  getSettings(@TenantCtx() ctx: JwtTenantPayload): Promise<InboxSettings> {
    return this.inboxService.getSettings(ctx.tenantId);
  }

  @Get("conversations/:id/messages")
  @Roles(Role.ADMIN, Role.AGENT, Role.QC)
  getConversationMessages(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<Message[]> {
    return this.inboxService.getConversationMessages(ctx.tenantId, id);
  }

  @Patch("conversations/:id/customer-name")
  @Roles(Role.ADMIN, Role.AGENT)
  renameCustomer(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: RenameCustomerDto
  ): Promise<Conversation> {
    return this.inboxService.renameCustomer(ctx.tenantId, ctx.sub, id, dto.nickname);
  }

  @Patch("conversations/:id/status")
  @Roles(Role.ADMIN, Role.AGENT)
  updateStatus(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: UpdateConversationStatusDto
  ): Promise<Conversation> {
    return this.inboxService.updateStatus(ctx.tenantId, ctx.sub, id, dto.status);
  }

  @Patch("settings")
  @Roles(Role.ADMIN)
  updateSettings(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: UpdateInboxSettingsDto
  ): Promise<InboxSettings> {
    return this.inboxService.updateSettings(
      ctx.tenantId,
      ctx.sub,
      dto.inProgressAlertMinutes
    );
  }
}

function readPositiveInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
