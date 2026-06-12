import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { TenantCtx } from "./decorators/tenant-context.decorator";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { TwoFaCodeDto } from "./dto/two-fa-code.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { TenantGuard } from "./guards/tenant.guard";
import { AuthResponse, AuthTokens, JwtTenantPayload } from "./types/auth.types";

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
}
