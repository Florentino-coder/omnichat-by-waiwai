import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuditAction, User, WorkspaceMember } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CryptoSecretService } from "./crypto-secret.service";
import { RefreshSessionService } from "./refresh-session.service";
import { TotpService } from "./totp.service";
import { AuthResponse, AuthTokens, AuthUserResponse, JwtTenantPayload } from "./types/auth.types";

type ActiveMembership = Pick<
  WorkspaceMember,
  "tenantId" | "workspaceId" | "role" | "isActive"
>;

type LoginUser = Pick<
  User,
  "id" | "email" | "passwordHash" | "displayName" | "isActive" | "deletedAt" | "emailVerified" | "twoFaEnabled" | "twoFaSecret"
> & {
  memberships: ActiveMembership[];
};

interface TwoFaContext {
  sub?: string;
  userId?: string;
  email: string;
  tenantId: string;
  workspaceId: string;
  role: JwtTenantPayload["role"];
}

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshSessionService: RefreshSessionService,
    private readonly cryptoSecretService: CryptoSecretService,
    private readonly totpService: TotpService
  ) {}

  async login(email: string, password: string, totpCode?: string): Promise<AuthResponse> {
    const user = await this.findLoginUser(email);
    const validPassword = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !validPassword) {
      if (user) {
        await this.auditLoginFailed(user, "INVALID_CREDENTIALS");
      }
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.assertUserCanLogin(user, totpCode);

    const membership = this.getPrimaryMembership(user);
    const tokens = await this.issueTokens(user, membership);

    await this.prisma.auditLog.create({
      data: {
        tenantId: membership.tenantId,
        userId: user.id,
        action: AuditAction.LOGIN
      }
    });

    return {
      tokens,
      user: this.toAuthUser(user, membership)
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            memberships: {
              where: { isActive: true },
              orderBy: { joinedAt: "asc" }
            }
          }
        }
      }
    });

    if (!storedToken) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (storedToken.revokedAt) {
      await this.handleRefreshReuse(storedToken.user);
      throw new UnauthorizedException("Refresh token reuse detected");
    }

    if (storedToken.expiresAt <= new Date()) {
      await this.revokeRefreshToken(tokenHash);
      throw new UnauthorizedException("Refresh token expired");
    }

    const session = await this.refreshSessionService.get(tokenHash);
    if (!session) {
      await this.revokeRefreshToken(tokenHash);
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = storedToken.user;
    this.assertUserAccountCanUseTokens(user);
    const membership = this.getPrimaryMembership(user);
    const tokens = await this.issueTokens(user, membership);
    await this.revokeRefreshToken(tokenHash);
    await this.refreshSessionService.delete(tokenHash, session.userId);

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const session = await this.refreshSessionService.get(tokenHash);
    await this.revokeRefreshToken(tokenHash);
    await this.refreshSessionService.delete(tokenHash, session?.userId);

    if (session) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: session.tenantId,
          userId: session.userId,
          action: AuditAction.LOGOUT
        }
      });
    }
  }

  async setupTwoFa(ctx: TwoFaContext): Promise<{ otpauthUri: string }> {
    const setup = this.totpService.generateSetup(ctx.email);
    await this.prisma.user.update({
      where: { id: this.contextUserId(ctx) },
      data: {
        twoFaSecret: this.cryptoSecretService.encrypt(setup.secret),
        twoFaEnabled: false
      }
    });

    return {
      otpauthUri: setup.otpauthUri
    };
  }

  async verifyTwoFa(ctx: TwoFaContext, code: string): Promise<void> {
    const user = await this.getTwoFaUser(this.contextUserId(ctx));
    this.assertTotpCode(user.twoFaSecret, code);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFaEnabled: true
      }
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: user.id,
        action: AuditAction.TWO_FA_ENABLED
      }
    });
  }

  async disableTwoFa(ctx: TwoFaContext, code: string): Promise<void> {
    const user = await this.getTwoFaUser(this.contextUserId(ctx));
    this.assertTotpCode(user.twoFaSecret, code);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFaSecret: null,
        twoFaEnabled: false
      }
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: user.id,
        action: AuditAction.TWO_FA_DISABLED
      }
    });
  }

  private async findLoginUser(email: string): Promise<LoginUser | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { isActive: true },
          orderBy: { joinedAt: "asc" }
        }
      }
    });
  }

  private async assertUserCanLogin(
    user: Pick<User, "id" | "isActive" | "deletedAt" | "emailVerified" | "twoFaEnabled" | "twoFaSecret"> & { memberships?: ActiveMembership[] },
    totpCode: string | undefined
  ): Promise<void> {
    this.assertUserAccountCanUseTokens(user);

    if (user.twoFaEnabled && !totpCode) {
      await this.auditLoginFailed(user, "MISSING_TOTP");
      throw new UnauthorizedException("Two-factor code is required");
    }

    if (user.twoFaEnabled) {
      try {
        this.assertTotpCode(user.twoFaSecret, totpCode);
      } catch (error) {
        await this.auditLoginFailed(user, "INVALID_TOTP");
        throw error;
      }
    }
  }

  private assertUserAccountCanUseTokens(
    user: Pick<User, "isActive" | "deletedAt" | "emailVerified">
  ): void {
    if (!user.isActive || user.deletedAt) {
      throw new UnauthorizedException("User is inactive");
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException("Email is not verified");
    }
  }

  private async auditLoginFailed(
    user: Pick<User, "id"> & { memberships?: ActiveMembership[] },
    reason: string
  ): Promise<void> {
    const membership = user.memberships?.find((item) => item.isActive);
    if (!membership) {
      return;
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId: membership.tenantId,
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        metadata: { reason }
      }
    });
  }

  private getPrimaryMembership(user: Pick<User, "id"> & { memberships: ActiveMembership[] }): ActiveMembership {
    const membership = user.memberships.find((item) => item.isActive);

    if (!membership) {
      throw new UnauthorizedException("User has no active workspace membership");
    }

    return membership;
  }

  private async issueTokens(
    user: Pick<User, "id" | "email">,
    membership: ActiveMembership
  ): Promise<AuthTokens> {
    const payload: JwtTenantPayload = {
      sub: user.id,
      email: user.email,
      tenantId: membership.tenantId,
      workspaceId: membership.workspaceId,
      role: membership.role
    };
    const refreshToken = this.createRefreshToken();
    const tokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = this.refreshExpiry();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });
    await this.refreshSessionService.store(tokenHash, {
      userId: user.id,
      tenantId: membership.tenantId,
      workspaceId: membership.workspaceId,
      role: membership.role,
      expiresAt: expiresAt.toISOString()
    });

    return {
      accessToken: await this.jwtService.signAsync(payload, {
        secret: this.requiredConfig("JWT_SECRET"),
        expiresIn: ACCESS_TOKEN_TTL
      }),
      refreshToken
    };
  }

  private toAuthUser(
    user: Pick<User, "id" | "email" | "displayName">,
    membership: ActiveMembership
  ): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      tenantId: membership.tenantId,
      workspaceId: membership.workspaceId,
      role: membership.role
    };
  }

  private createRefreshToken(): string {
    return randomBytes(48).toString("base64url");
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash("sha256").update(refreshToken).digest("hex");
  }

  private refreshExpiry(): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + REFRESH_TOKEN_DAYS);
    return expiry;
  }

  private async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  private async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  private async handleRefreshReuse(
    user: Pick<User, "id"> & { memberships: ActiveMembership[] }
  ): Promise<void> {
    await this.revokeAllUserRefreshTokens(user.id);
    await this.refreshSessionService.deleteAllForUser(user.id);
    const membership = this.getPrimaryMembership(user);
    await this.prisma.auditLog.create({
      data: {
        tenantId: membership.tenantId,
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        metadata: {
          reason: "REFRESH_REUSE_DETECTED"
        }
      }
    });
  }

  private async getTwoFaUser(userId: string): Promise<Pick<User, "id" | "email" | "twoFaSecret" | "twoFaEnabled">> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        twoFaSecret: true,
        twoFaEnabled: true
      }
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return user;
  }

  private assertTotpCode(encryptedSecret: string | null, code: string | undefined): void {
    if (!encryptedSecret || !this.totpService.verify(this.cryptoSecretService.decrypt(encryptedSecret), code)) {
      throw new UnauthorizedException("Invalid two-factor code");
    }
  }

  private contextUserId(ctx: TwoFaContext): string {
    const userId = ctx.sub ?? ctx.userId;
    if (!userId) {
      throw new UnauthorizedException("User context is required");
    }
    return userId;
  }

  private requiredConfig(name: string): string {
    const value = this.configService.get<string>(name);

    if (!value) {
      throw new UnauthorizedException(`${name} is not configured`);
    }

    return value;
  }
}
