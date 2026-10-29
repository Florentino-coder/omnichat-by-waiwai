import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";

export const MAX_FAILED_LOGIN_ATTEMPTS = 10;
export const LOGIN_LOCKOUT_SECONDS = 900;

/**
 * Per-account brute-force protection for password and TOTP login attempts.
 * IP-based throttling alone is bypassable by rotating IPs, so failures are
 * also counted per user in Redis. Redis outages fail open (login keeps
 * working) because the IP throttler still applies.
 */
@Injectable()
export class LoginAttemptService {
  private readonly logger = new Logger(LoginAttemptService.name);

  constructor(private readonly redisService: RedisService) {}

  async assertNotLocked(userId: string): Promise<void> {
    let attempts: number;
    try {
      attempts = Number((await this.redisService.client.get(this.key(userId))) ?? 0);
    } catch (error) {
      this.logger.warn(`Login lockout check skipped: ${this.describe(error)}`);
      return;
    }

    if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: "ACCOUNT_TEMPORARILY_LOCKED",
            message: "Too many failed login attempts. Try again in 15 minutes."
          }
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  async recordFailure(userId: string): Promise<void> {
    try {
      const key = this.key(userId);
      const attempts = await this.redisService.client.incr(key);
      if (attempts === 1) {
        await this.redisService.client.expire(key, LOGIN_LOCKOUT_SECONDS);
      }
    } catch (error) {
      this.logger.warn(`Failed to record login failure: ${this.describe(error)}`);
    }
  }

  async reset(userId: string): Promise<void> {
    try {
      await this.redisService.client.del(this.key(userId));
    } catch (error) {
      this.logger.warn(`Failed to reset login failures: ${this.describe(error)}`);
    }
  }

  private key(userId: string): string {
    return `login:failures:${userId}`;
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
