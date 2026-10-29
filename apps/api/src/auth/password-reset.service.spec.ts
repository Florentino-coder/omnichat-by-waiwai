import { BadRequestException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { createHash } from "crypto";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { LoginAttemptService } from "./login-attempt.service";
import { PASSWORD_RESET_TTL_SECONDS, PasswordResetService } from "./password-reset.service";
import { RefreshSessionService } from "./refresh-session.service";

const hash = (token: string): string => createHash("sha256").update(token).digest("hex");

const createDeps = () => {
  const store = new Map<string, string>();
  const redis = {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }),
    del: jest.fn(async (key: string) => (store.delete(key) ? 1 : 0))
  };
  const prisma = {
    user: {
      findFirst: jest.fn<Promise<unknown>, [unknown]>(),
      update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({ id: "user-1" })
    },
    refreshToken: {
      updateMany: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({ count: 1 })
    },
    auditLog: {
      create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({ id: "audit-1" })
    }
  };
  const mail = {
    sendPasswordReset: jest
      .fn<Promise<void>, Parameters<MailService["sendPasswordReset"]>>()
      .mockResolvedValue(undefined)
  };
  const refreshSessions = {
    deleteAllForUser: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined)
  };
  const loginAttempts = {
    reset: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined)
  };
  const service = new PasswordResetService(
    prisma as unknown as PrismaService,
    { client: redis } as unknown as RedisService,
    mail as unknown as MailService,
    refreshSessions as unknown as RefreshSessionService,
    loginAttempts as unknown as LoginAttemptService
  );
  return { store, redis, prisma, mail, refreshSessions, loginAttempts, service };
};

describe("PasswordResetService", () => {
  describe("requestReset", () => {
    it("emails a token to the account's registered address and stores only its hash", async () => {
      const deps = createDeps();
      deps.prisma.user.findFirst.mockResolvedValue({ id: "user-1", email: "owner@omnichat.local" });

      await deps.service.requestReset("  Owner  ");

      expect(deps.prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ email: "owner" }, { username: "owner" }]
          })
        })
      );
      const payload = deps.mail.sendPasswordReset.mock.calls[0][0];
      expect(payload.to).toBe("owner@omnichat.local");
      expect(payload.token.length).toBeGreaterThanOrEqual(43);
      expect(deps.store.get(`pwreset:${hash(payload.token)}`)).toBe("user-1");
      expect([...deps.store.values()]).not.toContain(payload.token);
      expect(deps.redis.set).toHaveBeenCalledWith(
        `pwreset:${hash(payload.token)}`,
        "user-1",
        "EX",
        PASSWORD_RESET_TTL_SECONDS
      );
    });

    it("does nothing and does not throw for unknown accounts", async () => {
      const deps = createDeps();
      deps.prisma.user.findFirst.mockResolvedValue(null);

      await expect(deps.service.requestReset("nobody@example.com")).resolves.toBeUndefined();
      expect(deps.mail.sendPasswordReset).not.toHaveBeenCalled();
      expect(deps.redis.set).not.toHaveBeenCalled();
    });

    it("invalidates the previous link when a new one is requested", async () => {
      const deps = createDeps();
      deps.prisma.user.findFirst.mockResolvedValue({ id: "user-1", email: "owner@omnichat.local" });

      await deps.service.requestReset("owner");
      const first = deps.mail.sendPasswordReset.mock.calls[0][0].token;
      await deps.service.requestReset("owner");

      expect(deps.store.has(`pwreset:${hash(first)}`)).toBe(false);
    });

    it("does not reveal email delivery failures", async () => {
      const deps = createDeps();
      deps.prisma.user.findFirst.mockResolvedValue({ id: "user-1", email: "owner@omnichat.local" });
      deps.mail.sendPasswordReset.mockRejectedValue(new Error("Email delivery failed"));

      await expect(deps.service.requestReset("owner")).resolves.toBeUndefined();
    });
  });

  describe("resetPassword", () => {
    const issueToken = async (deps: ReturnType<typeof createDeps>): Promise<string> => {
      deps.prisma.user.findFirst.mockResolvedValueOnce({ id: "user-1", email: "owner@omnichat.local" });
      await deps.service.requestReset("owner");
      return deps.mail.sendPasswordReset.mock.calls[0][0].token;
    };

    it("sets the new password, revokes sessions, clears lockout, and audits", async () => {
      const deps = createDeps();
      const token = await issueToken(deps);
      deps.prisma.user.findFirst.mockResolvedValueOnce({
        id: "user-1",
        memberships: [{ tenantId: "tenant-1" }]
      });

      await deps.service.resetPassword(token, "NewPassword123!");

      expect(deps.prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { passwordHash: expect.any(String) }
      });
      expect(deps.prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) }
      });
      expect(deps.refreshSessions.deleteAllForUser).toHaveBeenCalledWith("user-1");
      expect(deps.loginAttempts.reset).toHaveBeenCalledWith("user-1");
      expect(deps.prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-1",
          userId: "user-1",
          action: AuditAction.PASSWORD_CHANGED,
          metadata: { source: "forgot_password" }
        }
      });
    });

    it("rejects a token that was already used", async () => {
      const deps = createDeps();
      const token = await issueToken(deps);
      deps.prisma.user.findFirst.mockResolvedValue({ id: "user-1", memberships: [] });

      await deps.service.resetPassword(token, "NewPassword123!");
      await expect(deps.service.resetPassword(token, "Another123!")).rejects.toBeInstanceOf(
        BadRequestException
      );
      expect(deps.prisma.user.update).toHaveBeenCalledTimes(1);
    });

    it("rejects unknown or expired tokens", async () => {
      const deps = createDeps();
      await expect(
        deps.service.resetPassword("not-a-real-token", "NewPassword123!")
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(deps.prisma.user.update).not.toHaveBeenCalled();
    });

    it("rejects when a concurrent request consumed the token first", async () => {
      const deps = createDeps();
      const token = await issueToken(deps);
      deps.redis.del.mockResolvedValueOnce(0);

      await expect(deps.service.resetPassword(token, "NewPassword123!")).rejects.toBeInstanceOf(
        BadRequestException
      );
      expect(deps.prisma.user.update).not.toHaveBeenCalled();
    });

    it("rejects when the account was deactivated after the link was sent", async () => {
      const deps = createDeps();
      const token = await issueToken(deps);
      deps.prisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(deps.service.resetPassword(token, "NewPassword123!")).rejects.toBeInstanceOf(
        BadRequestException
      );
      expect(deps.prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
