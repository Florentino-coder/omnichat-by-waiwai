import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { readAccessTokenFromCookieHeader } from "../auth-cookie.util";
import { JwtTenantPayload, RequestWithUser } from "../types/auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser & { headers: Record<string, string | undefined> }>();
    const token = this.extractAccessToken(request.headers);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    let payload: JwtTenantPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtTenantPayload>(token, {
        secret: this.getJwtSecret()
      });
    } catch {
      throw new UnauthorizedException("Invalid bearer token");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        isActive: true,
        deletedAt: true,
        emailVerified: true,
        isSuperOwner: true
      }
    });

    if (!user || !user.isActive || user.deletedAt || !user.emailVerified) {
      throw new UnauthorizedException("User is inactive");
    }

    if (payload.isSuperOwner || user.isSuperOwner) {
      request.user = payload;
      return true;
    }

    if (!payload.tenantId || !payload.workspaceId) {
      throw new UnauthorizedException("Invalid token context");
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        userId: payload.sub,
        tenantId: payload.tenantId,
        workspaceId: payload.workspaceId,
        isActive: true,
        tenant: { isActive: true, deletedAt: null },
        workspace: { deletedAt: null }
      }
    });

    if (!membership) {
      throw new UnauthorizedException("Workspace membership is no longer active");
    }

    request.user = payload;
    return true;
  }

  private extractAccessToken(headers: Record<string, string | undefined>): string | undefined {
    const authHeader = headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice(7);
    }
    return readAccessTokenFromCookieHeader(headers.cookie);
  }

  private getJwtSecret(): string {
    const secret = this.configService.get<string>("JWT_SECRET");
    if (!secret) {
      throw new UnauthorizedException("JWT secret is not configured");
    }
    return secret;
  }
}
