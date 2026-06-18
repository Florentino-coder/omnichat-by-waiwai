import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { LineChannel, Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { ConnectLineChannelDto } from "./dto/connect-line-channel.dto";
import { ReplyLineMessageDto } from "./dto/reply-line-message.dto";
import { UpdateLineChannelDto } from "./dto/update-line-channel.dto";
import { BroadcastLineMessageDto, MulticastLineMessageDto } from "./dto/broadcast-line-message.dto";
import { LineChannelsService } from "./line-channels.service";
import { LineReplyService } from "./line-reply.service";
import { LineBroadcastService } from "./line-broadcast.service";

@Controller("line")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class LineChannelsController {
  constructor(
    private readonly lineChannelsService: LineChannelsService,
    private readonly lineReplyService: LineReplyService,
    private readonly lineBroadcastService: LineBroadcastService
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

  @Patch("channels/:id")
  @Roles(Role.ADMIN)
  update(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: UpdateLineChannelDto
  ): Promise<LineChannel> {
    return this.lineChannelsService.update(ctx.tenantId, ctx.sub, id, dto);
  }

  @Delete("channels/:id")
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<void> {
    return this.lineChannelsService.softDelete(ctx.tenantId, ctx.sub, id);
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

  @Post("channels/:channelId/broadcast")
  @Roles(Role.OWNER, Role.ADMIN)
  broadcast(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("channelId") channelId: string,
    @Body() dto: BroadcastLineMessageDto
  ) {
    return this.lineBroadcastService.createBroadcast(ctx.tenantId, ctx.sub, channelId, dto);
  }

  @Post("channels/:channelId/multicast")
  @Roles(Role.OWNER, Role.ADMIN)
  multicast(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("channelId") channelId: string,
    @Body() dto: MulticastLineMessageDto
  ) {
    return this.lineBroadcastService.createMulticast(ctx.tenantId, ctx.sub, channelId, dto);
  }

  @Get("channels/:channelId/broadcasts")
  @Roles(Role.OWNER, Role.ADMIN)
  getBroadcasts(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("channelId") channelId: string
  ) {
    return this.lineBroadcastService.getBroadcastJobs(ctx.tenantId, channelId);
  }
}
