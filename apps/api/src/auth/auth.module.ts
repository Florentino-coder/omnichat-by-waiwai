import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { RedisModule } from "../redis/redis.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CryptoSecretService } from "./crypto-secret.service";
import { RefreshSessionService } from "./refresh-session.service";
import { TotpService } from "./totp.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { TenantGuard } from "./guards/tenant.guard";

@Module({
  imports: [JwtModule.register({}), RedisModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshSessionService,
    CryptoSecretService,
    TotpService,
    JwtAuthGuard,
    TenantGuard,
    RolesGuard
  ],
  exports: [JwtModule, AuthService, JwtAuthGuard, TenantGuard, RolesGuard]
})
export class AuthModule {}
