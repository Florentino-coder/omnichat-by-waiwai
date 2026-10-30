import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { RequestWithUser } from "../../auth/types/auth.types";

@Injectable()
export class SuperOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user?.isSuperOwner !== true) {
      return false;
    }

    // This role reaches every tenant, so a stolen password alone must not be enough.
    if (request.user.twoFaEnabled !== true) {
      throw new ForbiddenException({
        code: "SUPER_OWNER_2FA_REQUIRED",
        message: "Set up two-factor authentication to use the platform console."
      });
    }

    return true;
  }
}
