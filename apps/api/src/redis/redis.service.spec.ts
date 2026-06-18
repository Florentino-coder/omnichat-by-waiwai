import { ConfigService } from "@nestjs/config";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { RedisModule } from "./redis.module";
import { createRedisOptions, REDIS_FACTORY, RedisService } from "./redis.service";

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
  it("uses bounded retry options for hosted Redis", () => {
    const options = createRedisOptions();

    expect(options.connectTimeout).toBe(5000);
    expect(options.enableOfflineQueue).toBe(false);
    expect(options.maxRetriesPerRequest).toBe(3);
    expect(options.retryStrategy?.(1)).toBe(1000);
    expect(options.retryStrategy?.(60)).toBe(30000);
  });

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

  it("attaches error handlers to Redis clients", () => {
    const config = {
      get: (key: string): string | undefined =>
        key === "REDIS_URL" ? "redis://redis.example.test:6379" : undefined
    };
    const client = createRedisClient();

    const service = new RedisService(config as ConfigService, () => client);

    expect(service.client).toBe(client);
    expect(client.on).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("throttles repeated Redis error logs for the same connection", () => {
    const config = {
      get: (key: string): string | undefined =>
        key === "REDIS_URL" ? "redis://redis.example.test:6379" : undefined
    };
    let errorHandler: ((error: Error) => void) | undefined;
    const client = createRedisClient();
    client.on.mockImplementation((_event: "error", handler: (error: Error) => void) => {
        errorHandler = handler;
    });
    const service = new RedisService(config as ConfigService, () => client);
    const logger = (service as unknown as { logger: { warn: jest.Mock<void, [string]> } }).logger;
    logger.warn = jest.fn<void, [string]>();
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000);

    errorHandler?.(new Error("read ECONNRESET"));
    errorHandler?.(new Error("read ECONNRESET"));
    nowSpy.mockReturnValue(62_000);
    errorHandler?.(new Error("read ECONNRESET"));

    expect(logger.warn).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it("attaches error handlers to subscriber Redis clients", () => {
    const config = {
      get: (key: string): string | undefined =>
        key === "REDIS_URL" ? "redis://redis.example.test:6379" : undefined
    };
    const subscriber = createRedisClient();
    const client = {
      ...createRedisClient(),
      duplicate: jest.fn().mockReturnValue(subscriber)
    };
    const service = new RedisService(config as ConfigService, () => client);

    service.createSubscriber();

    expect(subscriber.on).toHaveBeenCalledWith("error", expect.any(Function));
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
