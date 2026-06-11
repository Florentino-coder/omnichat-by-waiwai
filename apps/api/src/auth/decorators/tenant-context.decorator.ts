import { createParamDecorator, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { JwtTenantPayload, RequestWithUser } from "../types/auth.types";

export const TenantCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtTenantPayload => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      throw new ForbiddenException("Tenant context is required");
    }
    return request.user;
  }
);
