import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { JwtTenantPayload, RequestWithUser } from "../types/auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser & { headers: Record<string, string | undefined> }>();
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      request.user = await this.jwtService.verifyAsync<JwtTenantPayload>(token, {
        secret: this.getJwtSecret()
      });
      return true;
    } catch {
      throw new UnauthorizedException("Invalid bearer token");
    }
  }

  private getJwtSecret(): string {
    const secret = this.configService.get<string>("JWT_SECRET");
    if (!secret) {
      throw new UnauthorizedException("JWT secret is not configured");
    }
    return secret;
  }
}
