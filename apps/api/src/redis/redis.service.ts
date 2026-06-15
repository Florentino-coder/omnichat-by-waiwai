import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

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
  on(event: "message", handler: (channel: string, message: string) => void): void;
  off(event: "message", handler: (channel: string, message: string) => void): void;
  duplicate?(): RedisClient;
  quit?(): Promise<unknown>;
}

export type RedisFactory = (url: string) => RedisClient;

export const REDIS_FACTORY = "REDIS_FACTORY";

export const defaultRedisFactory: RedisFactory = (url) => new Redis(url) as unknown as RedisClient;

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: RedisClient;
  private readonly subscribers: RedisClient[] = [];

  constructor(
    configService: ConfigService,
    @Inject(REDIS_FACTORY) factory: RedisFactory = defaultRedisFactory
  ) {
    this.client = factory(configService.get<string>("REDIS_URL") ?? "redis://localhost:6379");
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.subscribers.map((subscriber) => subscriber.quit?.()));
    await this.client.quit?.();
  }

  createSubscriber(): RedisClient {
    const subscriber = this.client.duplicate?.() ?? this.client;
    this.subscribers.push(subscriber);
    return subscriber;
  }
}
