import { ConfigService } from "@nestjs/config";
import { RedisService } from "./redis.service";

describe("RedisService", () => {
  it("wraps ioredis using REDIS_URL", () => {
    const config = {
      get: (key: string): string | undefined =>
        key === "REDIS_URL" ? "redis://redis.example.test:6379" : undefined
    };
    const createdUrls: string[] = [];

    const service = new RedisService(config as ConfigService, (url: string) => {
      createdUrls.push(url);
      return {
        set: jest.fn(),
        get: jest.fn(),
        del: jest.fn(),
        sadd: jest.fn(),
        srem: jest.fn(),
        smembers: jest.fn()
      };
    });

    expect(service.client).toBeDefined();
    expect(createdUrls).toEqual(["redis://redis.example.test:6379"]);
  });
});
