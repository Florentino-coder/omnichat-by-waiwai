import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { JwtTenantPayload, RequestWithUser } from "../types/auth.types";

export const TenantCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtTenantPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  }
);
