import { HttpException, HttpStatus } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";
import {
  LOGIN_LOCKOUT_SECONDS,
  LoginAttemptService,
  MAX_FAILED_LOGIN_ATTEMPTS
} from "./login-attempt.service";

const createRedis = () => ({
  get: jest.fn<Promise<string | null>, [string]>(),
  incr: jest.fn<Promise<number>, [string]>(),
  expire: jest.fn<Promise<number>, [string, number]>().mockResolvedValue(1),
  del: jest.fn<Promise<unknown>, [string]>().mockResolvedValue(1)
});

const createService = (redis: ReturnType<typeof createRedis>): LoginAttemptService =>
  new LoginAttemptService({ client: redis } as unknown as RedisService);

describe("LoginAttemptService", () => {
  it("allows login below the failure threshold", async () => {
    const redis = createRedis();
    redis.get.mockResolvedValue(String(MAX_FAILED_LOGIN_ATTEMPTS - 1));
    await expect(createService(redis).assertNotLocked("user-1")).resolves.toBeUndefined();
    expect(redis.get).toHaveBeenCalledWith("login:failures:user-1");
  });

  it("locks the account at the failure threshold with 429", async () => {
    const redis = createRedis();
    redis.get.mockResolvedValue(String(MAX_FAILED_LOGIN_ATTEMPTS));
    const error = await createService(redis)
      .assertNotLocked("user-1")
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it("sets the lockout window on the first failure only", async () => {
    const redis = createRedis();
    redis.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const service = createService(redis);
    await service.recordFailure("user-1");
    await service.recordFailure("user-1");
    expect(redis.expire).toHaveBeenCalledTimes(1);
    expect(redis.expire).toHaveBeenCalledWith("login:failures:user-1", LOGIN_LOCKOUT_SECONDS);
  });

  it("clears failures on reset", async () => {
    const redis = createRedis();
    await createService(redis).reset("user-1");
    expect(redis.del).toHaveBeenCalledWith("login:failures:user-1");
  });

  it("fails open when Redis is unavailable", async () => {
    const redis = createRedis();
    redis.get.mockRejectedValue(new Error("ECONNREFUSED"));
    redis.incr.mockRejectedValue(new Error("ECONNREFUSED"));
    const service = createService(redis);
    await expect(service.assertNotLocked("user-1")).resolves.toBeUndefined();
    await expect(service.recordFailure("user-1")).resolves.toBeUndefined();
  });
});
