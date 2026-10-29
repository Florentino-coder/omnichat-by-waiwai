import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { LoginAttemptService } from "./login-attempt.service";
import { RefreshSessionService } from "./refresh-session.service";

export const PASSWORD_RESET_TTL_SECONDS = 1800;

/**
 * Email-link password reset. Knowing an account's email is not proof of
 * ownership, so the new password is only accepted together with a single-use
 * token delivered to that inbox. Tokens are stored hashed in Redis.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
    private readonly refreshSessionService: RefreshSessionService,
    private readonly loginAttemptService: LoginAttemptService
  ) {}

  /**
   * Always resolves without revealing whether the account exists, so the
   * endpoint cannot be used to enumerate registered emails or usernames.
   */
  async requestReset(identifier: string): Promise<void> {
    const normalized = identifier.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: normalized }, { username: normalized }],
        deletedAt: null,
        isActive: true
      },
      select: { id: true, email: true }
    });

    if (!user) {
      return;
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = this.hash(token);
    const userKey = this.userKey(user.id);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000);

    try {
      // Only the most recent link stays valid.
      const previousHash = await this.redisService.client.get(userKey);
      if (previousHash) {
        await this.redisService.client.del(this.tokenKey(previousHash));
      }
      await this.redisService.client.set(
        this.tokenKey(tokenHash),
        user.id,
        "EX",
        PASSWORD_RESET_TTL_SECONDS
      );
      await this.redisService.client.set(userKey, tokenHash, "EX", PASSWORD_RESET_TTL_SECONDS);
      await this.mailService.sendPasswordReset({ to: user.email, token, expiresAt });
    } catch (error) {
      this.logger.error(
        `Password reset email could not be issued for user ${user.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hash(token);
    const tokenKey = this.tokenKey(tokenHash);
    const userId = await this.redisService.client.get(tokenKey);

    // del() returns the number of keys removed; 0 means a concurrent request
    // already consumed this token, which keeps it single-use.
    const consumed = userId ? Number(await this.redisService.client.del(tokenKey)) : 0;
    if (!userId || consumed !== 1) {
      throw new BadRequestException("Reset link is invalid or has expired");
    }
    await this.redisService.client.del(this.userKey(userId));

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      select: {
        id: true,
        memberships: {
          where: { isActive: true },
          orderBy: { joinedAt: "asc" },
          select: { tenantId: true }
        }
      }
    });
    if (!user) {
      throw new BadRequestException("Reset link is invalid or has expired");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await this.refreshSessionService.deleteAllForUser(user.id);
    await this.loginAttemptService.reset(user.id);

    const membership = user.memberships[0];
    if (membership) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: membership.tenantId,
          userId: user.id,
          action: AuditAction.PASSWORD_CHANGED,
          metadata: { source: "forgot_password" }
        }
      });
    }
  }

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private tokenKey(tokenHash: string): string {
    return `pwreset:${tokenHash}`;
  }

  private userKey(userId: string): string {
    return `pwreset:user:${userId}`;
  }
}
