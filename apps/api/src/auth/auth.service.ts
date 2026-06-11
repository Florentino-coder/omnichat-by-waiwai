import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuditAction, User, WorkspaceMember } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuthResponse, AuthTokens, AuthUserResponse, JwtTenantPayload } from "./types/auth.types";

type ActiveMembership = Pick<
  WorkspaceMember,
  "tenantId" | "workspaceId" | "role" | "isActive"
>;

type LoginUser = Pick<
  User,
  "id" | "email" | "passwordHash" | "displayName" | "isActive" | "deletedAt" | "emailVerified" | "twoFaEnabled"
> & {
  memberships: ActiveMembership[];
};

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async login(email: string, password: string, totpCode?: string): Promise<AuthResponse> {
    const user = await this.findLoginUser(email);
    const validPassword = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !validPassword) {
      throw new UnauthorizedException("Invalid email or password");
    }

    this.assertUserCanLogin(user, totpCode);

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
      await this.revokeAllUserRefreshTokens(storedToken.userId);
      throw new UnauthorizedException("Refresh token reuse detected");
    }

    if (storedToken.expiresAt <= new Date()) {
      await this.revokeRefreshToken(tokenHash);
      throw new UnauthorizedException("Refresh token expired");
    }

    const user = storedToken.user;
    this.assertUserCanLogin(user, undefined);
    const membership = this.getPrimaryMembership(user);
    const tokens = await this.issueTokens(user, membership);
    await this.revokeRefreshToken(tokenHash);

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.revokeRefreshToken(this.hashRefreshToken(refreshToken));
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

  private assertUserCanLogin(
    user: Pick<User, "isActive" | "deletedAt" | "emailVerified" | "twoFaEnabled">,
    totpCode: string | undefined
  ): void {
    if (!user.isActive || user.deletedAt) {
      throw new UnauthorizedException("User is inactive");
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException("Email is not verified");
    }

    if (user.twoFaEnabled && !totpCode) {
      throw new UnauthorizedException("Two-factor code is required");
    }
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

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: this.refreshExpiry()
      }
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

  private requiredConfig(name: string): string {
    const value = this.configService.get<string>(name);

    if (!value) {
      throw new UnauthorizedException(`${name} is not configured`);
    }

    return value;
  }
}
