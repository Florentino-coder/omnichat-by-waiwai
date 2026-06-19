import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Observable } from "rxjs";
import { RedisService } from "../redis/redis.service";

export interface TenantRealtimeEvent {
  type: string;
  data: unknown;
  flowId?: string;
}

type RedisMessageHandler = (channel: string, message: string) => void;
type RealtimeRedisClient = {
  publish(channel: string, message: string): Promise<unknown>;
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(event: "message", handler: RedisMessageHandler): void;
  off(event: "message", handler: RedisMessageHandler): void;
  quit?(): Promise<unknown>;
};
@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private subscriber?: RealtimeRedisClient;
  private readonly handlers = new Map<string, Set<(event: TenantRealtimeEvent) => void>>();
  private readonly redisMessageHandler: RedisMessageHandler = (channel, message) => {
    const tenantId = readTenantIdFromChannel(channel);
    if (!tenantId) {
      return;
    }

    const subscribers = this.handlers.get(tenantId);
    if (!subscribers?.size) {
      return;
    }

    const parsed = parseRedisEvent(message);
    if (!parsed) {
      return;
    }

    if (parsed.flowId) {
      const now = Date.now();
      console.log(`[TRACE] [REDIS_SUBSCRIBE_RECEIVE] flowId=${parsed.flowId} ts=${now} time=${new Date(now).toISOString()}`);
    }

    subscribers.forEach((handler) => handler(parsed));
  };

  constructor(private readonly redisService: RedisService) {}

  async publishTenantEvent(tenantId: string, type: string, data: unknown, flowId?: string): Promise<void> {
    if (flowId) {
      const now = Date.now();
      console.log(`[TRACE] [REDIS_PUBLISH] flowId=${flowId} ts=${now} time=${new Date(now).toISOString()}`);
    }
    await this.redisService.client.publish(
      tenantChannel(tenantId),
      JSON.stringify({ event: type, data, flowId })
    );
  }

  streamTenantEvents(tenantId: string): Observable<TenantRealtimeEvent> {
    return new Observable<TenantRealtimeEvent>((subscriber) => {
      const redisSubscriber = this.ensureSubscriber();
      const handler = (event: TenantRealtimeEvent): void => subscriber.next(event);
      const existing = this.handlers.get(tenantId) ?? new Set<(event: TenantRealtimeEvent) => void>();
      existing.add(handler);
      this.handlers.set(tenantId, existing);
      void redisSubscriber.subscribe(tenantChannel(tenantId));

      const heartbeat = setInterval(() => {
        subscriber.next({ type: "heartbeat", data: { ts: Date.now() } });
      }, 15000);

      return () => {
        clearInterval(heartbeat);
        existing.delete(handler);
        if (existing.size === 0) {
          this.handlers.delete(tenantId);
          void redisSubscriber.unsubscribe(tenantChannel(tenantId));
        }
      };
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.subscriber) {
      return;
    }

    this.subscriber.off("message", this.redisMessageHandler);
    await this.subscriber.quit?.();
  }

  private ensureSubscriber(): RealtimeRedisClient {
    if (!this.subscriber) {
      this.subscriber =
        typeof this.redisService.createSubscriber === "function"
          ? this.redisService.createSubscriber()
          : this.redisService.client;
      this.subscriber.on("message", this.redisMessageHandler);
    }

    return this.subscriber;
  }
}

export const tenantChannel = (tenantId: string): string => `tenant:${tenantId}:events`;

function readTenantIdFromChannel(channel: string): string | null {
  const match = /^tenant:([^:]+):events$/.exec(channel);
  return match?.[1] ?? null;
}

function parseRedisEvent(message: string): TenantRealtimeEvent | null {
  try {
    const parsed = JSON.parse(message) as { event?: unknown; data?: unknown; flowId?: string };
    return typeof parsed.event === "string"
      ? { type: parsed.event, data: parsed.data, flowId: parsed.flowId }
      : null;
  } catch {
    return null;
  }
}
