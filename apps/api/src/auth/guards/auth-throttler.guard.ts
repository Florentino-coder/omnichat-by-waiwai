import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

type ThrottledRequest = {
  ip?: string;
  body?: { email?: unknown; identifier?: unknown };
  user?: { sub?: string };
};

/**
 * Browser traffic reaches the API through the Next.js proxy, so req.ip is the
 * proxy's address for every user. Keying auth throttles by IP would make all
 * users share one bucket. Track by authenticated user, then by submitted
 * email/identifier, and fall back to IP only when neither exists.
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: ThrottledRequest): Promise<string> {
    if (req.user?.sub) {
      return `user:${req.user.sub}`;
    }

    const account = req.body?.email ?? req.body?.identifier;
    if (typeof account === "string" && account.trim()) {
      return `account:${account.trim().toLowerCase()}`;
    }

    return `ip:${req.ip ?? "unknown"}`;
  }
}
