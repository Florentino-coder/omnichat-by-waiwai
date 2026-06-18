import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import type { RedisOptions } from "ioredis";

export interface RedisClient {
  set(key: string, value: string, mode: "EX", ttlSeconds: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string | string[]): Promise<unknown>;
  sadd(key: string, member: string): Promise<unknown>;
  srem(key: string, member: string): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  publish(channel: string, message: string): Promise<unknown>;
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(event: "error", handler: (error: Error) => void): void;
  on(event: "message", handler: (channel: string, message: string) => void): void;
  off(event: "error", handler: (error: Error) => void): void;
  off(event: "message", handler: (channel: string, message: string) => void): void;
  duplicate?(): RedisClient;
  quit?(): Promise<unknown>;
}

export type RedisFactory = (url: string) => RedisClient;

export const REDIS_FACTORY = "REDIS_FACTORY";
const REDIS_ERROR_LOG_THROTTLE_MS = 60000;

export const createRedisOptions = (): RedisOptions => ({
  connectTimeout: 5000,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 1000, 30000)
});

export const defaultRedisFactory: RedisFactory = (url) =>
  new Redis(url, createRedisOptions()) as unknown as RedisClient;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: RedisClient;
  private readonly subscribers: RedisClient[] = [];
  private readonly lastErrorLogAt = new Map<string, number>();

  constructor(
    configService: ConfigService,
    @Inject(REDIS_FACTORY) factory: RedisFactory = defaultRedisFactory
  ) {
    this.client = factory(configService.get<string>("REDIS_URL") ?? "redis://localhost:6379");
    this.attachErrorHandler(this.client, "primary");
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.subscribers.map((subscriber) => subscriber.quit?.()));
    await this.client.quit?.();
  }

  createSubscriber(): RedisClient {
    const subscriber = this.client.duplicate?.() ?? this.client;
    this.subscribers.push(subscriber);
    this.attachErrorHandler(subscriber, "subscriber");
    return subscriber;
  }

  private attachErrorHandler(client: RedisClient, label: string): void {
    client.on("error", (error) => {
      const logKey = `${label}:${error.message}`;
      const now = Date.now();
      const lastLogAt = this.lastErrorLogAt.get(logKey);
      if (lastLogAt && now - lastLogAt < REDIS_ERROR_LOG_THROTTLE_MS) {
        return;
      }
      this.lastErrorLogAt.set(logKey, now);
      this.logger.warn(`Redis ${label} connection error: ${error.message}`);
    });
  }
}
