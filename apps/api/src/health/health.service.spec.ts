import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { HealthService } from "./health.service";

type MockPrisma = {
  $queryRaw: jest.Mock<Promise<unknown>, [TemplateStringsArray]>;
};

const createConfig = (redisUrl?: string): ConfigService =>
  ({
    get: (key: string): string | undefined =>
      key === "REDIS_URL" ? redisUrl : undefined
  }) as ConfigService;

const createService = (
  prisma: MockPrisma,
  redisUrl?: string,
  redis: { client: { ping: jest.Mock<Promise<string>, []> } } = {
    client: { ping: jest.fn<Promise<string>, []>().mockResolvedValue("PONG") }
  }
): HealthService =>
  new HealthService(
    prisma as unknown as PrismaService,
    createConfig(redisUrl),
    redis as unknown as RedisService
  );

describe("HealthService", () => {
  it("returns degraded when Redis is not configured", async () => {
    const prisma: MockPrisma = {
      $queryRaw: jest.fn<Promise<unknown>, [TemplateStringsArray]>().mockResolvedValue(1)
    };

    await expect(createService(prisma).check()).resolves.toMatchObject({
      status: "degraded",
      services: {
        database: "up",
        redis: "not_configured",
        r2: "not_configured"
      }
    });
  });

  it("returns degraded when database check fails", async () => {
    const prisma: MockPrisma = {
      $queryRaw: jest
        .fn<Promise<unknown>, [TemplateStringsArray]>()
        .mockRejectedValue(new Error("DB down"))
    };

    await expect(createService(prisma).check()).resolves.toMatchObject({
      status: "degraded",
      services: {
        database: "down",
        redis: "not_configured",
        r2: "not_configured"
      }
    });
  });

  it("returns ok when Redis ping succeeds", async () => {
    const prisma: MockPrisma = {
      $queryRaw: jest.fn<Promise<unknown>, [TemplateStringsArray]>().mockResolvedValue(1)
    };
    const redis = {
      client: { ping: jest.fn<Promise<string>, []>().mockResolvedValue("PONG") }
    };

    await expect(createService(prisma, "rediss://redis.example.test:6379", redis).check()).resolves.toMatchObject({
      status: "ok",
      services: {
        database: "up",
        redis: "up",
        r2: "not_configured"
      }
    });
    expect(redis.client.ping).toHaveBeenCalled();
  });

  it("returns degraded when Redis ping fails", async () => {
    const prisma: MockPrisma = {
      $queryRaw: jest.fn<Promise<unknown>, [TemplateStringsArray]>().mockResolvedValue(1)
    };
    const redis = {
      client: { ping: jest.fn<Promise<string>, []>().mockRejectedValue(new Error("wrong redis")) }
    };

    await expect(createService(prisma, "rediss://redis.example.test:6379", redis).check()).resolves.toMatchObject({
      status: "degraded",
      services: {
        database: "up",
        redis: "down",
        r2: "not_configured"
      }
    });
  });
});
