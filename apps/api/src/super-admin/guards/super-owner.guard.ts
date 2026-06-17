import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { RequestWithUser } from "../../auth/types/auth.types";

@Injectable()
export class SuperOwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user?.isSuperOwner === true;
  }
}
