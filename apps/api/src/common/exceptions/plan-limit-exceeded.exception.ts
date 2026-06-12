import { ForbiddenException } from "@nestjs/common";

export class PlanLimitExceededException extends ForbiddenException {
  constructor(message: string, details?: unknown) {
    super({
      code: "PLAN_LIMIT_EXCEEDED",
      message,
      details
    });
  }
}
