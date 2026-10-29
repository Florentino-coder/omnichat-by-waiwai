import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CryptoSecretService } from "./crypto-secret.service";
import { LoginAttemptService } from "./login-attempt.service";
import { PasswordResetService } from "./password-reset.service";
import { MailModule } from "../mail/mail.module";
import { RefreshSessionService } from "./refresh-session.service";
import { TotpService } from "./totp.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { TenantGuard } from "./guards/tenant.guard";

@Module({
  imports: [
    JwtModule.register({}),
    ThrottlerModule.forRoot([
      {
        name: "forgot-password",
        ttl: 900_000,
        limit: 5
      },
      {
        // Per-IP brute-force limit for login, refresh, and 2FA code endpoints.
        name: "auth-sensitive",
        ttl: 900_000,
        limit: 20
      }
    ]),
    PrismaModule,
    RedisModule,
    MailModule
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshSessionService,
    CryptoSecretService,
    LoginAttemptService,
    PasswordResetService,
    TotpService,
    JwtAuthGuard,
    TenantGuard,
    RolesGuard
  ],
  exports: [
    JwtModule,
    AuthService,
    CryptoSecretService,
    RefreshSessionService,
    JwtAuthGuard,
    TenantGuard,
    RolesGuard
  ]
})
export class AuthModule {}
