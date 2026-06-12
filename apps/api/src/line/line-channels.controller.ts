import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { LineChannel, Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { ConnectLineChannelDto } from "./dto/connect-line-channel.dto";
import { ReplyLineMessageDto } from "./dto/reply-line-message.dto";
import { LineChannelsService } from "./line-channels.service";
import { LineReplyService } from "./line-reply.service";

@Controller("line")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class LineChannelsController {
  constructor(
    private readonly lineChannelsService: LineChannelsService,
    private readonly lineReplyService: LineReplyService
  ) {}

  @Get("channels")
  @Roles(Role.AGENT)
  list(@TenantCtx() ctx: JwtTenantPayload): Promise<LineChannel[]> {
    return this.lineChannelsService.list(ctx.tenantId);
  }

  @Post("channels")
  @Roles(Role.ADMIN)
  connect(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: ConnectLineChannelDto
  ): Promise<LineChannel> {
    return this.lineChannelsService.connect(ctx.tenantId, ctx.sub, dto);
  }

  @Post("conversations/:id/reply")
  @Roles(Role.AGENT)
  reply(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: ReplyLineMessageDto
  ): Promise<void> {
    return this.lineReplyService.replyText(ctx.tenantId, ctx.sub, id, dto);
  }
}

