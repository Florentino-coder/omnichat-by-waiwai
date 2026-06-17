import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { TenantCtx } from "./decorators/tenant-context.decorator";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { SwitchTenantDto } from "./dto/switch-tenant.dto";
import { TwoFaCodeDto } from "./dto/two-fa-code.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { TenantGuard } from "./guards/tenant.guard";
import {
  AuthResponse,
  AuthTokens,
  JwtTenantPayload,
  TenantMembershipResponse
} from "./types/auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto.email, dto.password, dto.totpCode);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokens> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @Get("memberships")
  @UseGuards(JwtAuthGuard, TenantGuard)
  listMemberships(@TenantCtx() ctx: JwtTenantPayload): Promise<TenantMembershipResponse[]> {
    return this.authService.listMemberships(ctx.sub);
  }

  @Post("switch-tenant")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, TenantGuard)
  switchTenant(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: SwitchTenantDto
  ): Promise<AuthResponse> {
    return this.authService.switchTenant(ctx, dto.workspaceId);
  }

  @Post("2fa/setup")
  @UseGuards(JwtAuthGuard, TenantGuard)
  setupTwoFa(@TenantCtx() ctx: JwtTenantPayload): Promise<{ otpauthUri: string }> {
    return this.authService.setupTwoFa(ctx);
  }

  @Post("2fa/verify")
  @UseGuards(JwtAuthGuard, TenantGuard)
  verifyTwoFa(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: TwoFaCodeDto
  ): Promise<void> {
    return this.authService.verifyTwoFa(ctx, dto.code);
  }

  @Post("2fa/disable")
  @UseGuards(JwtAuthGuard, TenantGuard)
  disableTwoFa(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: TwoFaCodeDto
  ): Promise<void> {
    return this.authService.disableTwoFa(ctx, dto.code);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, TenantGuard)
  async changePassword(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: ChangePasswordDto
  ): Promise<void> {
    await this.authService.changePassword(ctx.sub, ctx.tenantId, dto);
  }
}
