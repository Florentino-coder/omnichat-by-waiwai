import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { Conversation, Message, Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { RenameCustomerDto } from "./dto/rename-customer.dto";
import { InboxConversation, InboxService } from "./inbox.service";

@Controller("inbox")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get("conversations")
  @Roles(Role.ADMIN, Role.AGENT, Role.QC)
  listConversations(@TenantCtx() ctx: JwtTenantPayload): Promise<InboxConversation[]> {
    return this.inboxService.listConversations(ctx.tenantId);
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
}
