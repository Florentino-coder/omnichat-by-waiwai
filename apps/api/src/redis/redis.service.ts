import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export interface RedisClient {
  set(key: string, value: string, mode: "EX", ttlSeconds: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string | string[]): Promise<unknown>;
  sadd(key: string, member: string): Promise<unknown>;
  srem(key: string, member: string): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  quit?(): Promise<unknown>;
}

type RedisFactory = (url: string) => RedisClient;

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: RedisClient;

  constructor(
    configService: ConfigService,
    factory: RedisFactory = (url) => new Redis(url) as unknown as RedisClient
  ) {
    this.client = factory(configService.get<string>("REDIS_URL") ?? "redis://localhost:6379");
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit?.();
  }
}
