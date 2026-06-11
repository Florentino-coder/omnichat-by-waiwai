import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { SafeUserProfile } from "./types/user.types";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard, TenantGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  getMe(@TenantCtx() ctx: JwtTenantPayload): Promise<SafeUserProfile> {
    return this.usersService.getMe(ctx.sub, ctx.tenantId);
  }

  @Patch("me")
  updateMe(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: UpdateProfileDto
  ): Promise<SafeUserProfile> {
    return this.usersService.updateMe(ctx.sub, ctx.tenantId, dto);
  }
}
