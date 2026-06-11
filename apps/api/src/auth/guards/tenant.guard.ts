import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { RequestWithUser } from "../types/auth.types";

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!request.user?.tenantId || !request.user.workspaceId) {
      throw new ForbiddenException("Tenant context is required");
    }

    return true;
  }
}
