import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
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
  redisUrl?: string
): HealthService =>
  new HealthService(prisma as unknown as PrismaService, createConfig(redisUrl));

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
});
