import { ConfigService } from "@nestjs/config";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { RedisModule } from "./redis.module";
import { REDIS_FACTORY, RedisService } from "./redis.service";

const createRedisClient = () => ({
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  sadd: jest.fn(),
  srem: jest.fn(),
  smembers: jest.fn(),
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  quit: jest.fn()
});

describe("RedisService", () => {
  it("wraps ioredis using REDIS_URL", () => {
    const config = {
      get: (key: string): string | undefined =>
        key === "REDIS_URL" ? "redis://redis.example.test:6379" : undefined
    };
    const createdUrls: string[] = [];

    const service = new RedisService(config as ConfigService, (url: string) => {
      createdUrls.push(url);
      return createRedisClient();
    });

    expect(service.client).toBeDefined();
    expect(createdUrls).toEqual(["redis://redis.example.test:6379"]);
  });

  it("can be created by Nest dependency injection", async () => {
    const moduleBuilder = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ REDIS_URL: "redis://redis.example.test:6379" })]
        }),
        RedisModule
      ]
    }).overrideProvider(REDIS_FACTORY);

    const moduleRef = await moduleBuilder
      .useValue(() => createRedisClient())
      .compile();

    const service = moduleRef.get(RedisService);

    expect(service.client).toBeDefined();
    await moduleRef.close();
  });
});
