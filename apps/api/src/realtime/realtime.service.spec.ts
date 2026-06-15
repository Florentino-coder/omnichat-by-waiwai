import { RealtimeService } from "./realtime.service";
import { RedisService } from "../redis/redis.service";

type RedisHandler = (channel: string, message: string) => void;

const createRedis = (): {
  publish: jest.Mock<Promise<unknown>, [string, string]>;
  subscribe: jest.Mock<Promise<unknown>, [string]>;
  unsubscribe: jest.Mock<Promise<unknown>, [string]>;
  on: jest.Mock<void, ["message", RedisHandler]>;
  off: jest.Mock<void, ["message", RedisHandler]>;
  emitMessage: (channel: string, message: string) => void;
} => {
  let handler: RedisHandler | undefined;
  return {
    publish: jest.fn<Promise<unknown>, [string, string]>().mockResolvedValue(1),
    subscribe: jest.fn<Promise<unknown>, [string]>().mockResolvedValue(1),
    unsubscribe: jest.fn<Promise<unknown>, [string]>().mockResolvedValue(1),
    on: jest.fn<void, ["message", RedisHandler]>((_event, nextHandler) => {
      handler = nextHandler;
    }),
    off: jest.fn<void, ["message", RedisHandler]>(),
    emitMessage: (channel, message) => handler?.(channel, message)
  };
};

describe("RealtimeService", () => {
  it("publishes tenant-scoped events through Redis Pub/Sub", async () => {
    const redis = createRedis();
    const service = new RealtimeService({ client: redis } as unknown as RedisService);

    await service.publishTenantEvent("tenant-1", "message.created", { messageId: "message-1" });

    expect(redis.publish).toHaveBeenCalledWith(
      "tenant:tenant-1:events",
      JSON.stringify({ event: "message.created", data: { messageId: "message-1" } })
    );
  });

  it("subscribes one tenant stream and ignores other tenant channels", async () => {
    const redis = createRedis();
    const service = new RealtimeService({ client: redis } as unknown as RedisService);
    const received: unknown[] = [];

    const subscription = service.streamTenantEvents("tenant-1").subscribe((event) => {
      received.push(event);
    });
    redis.emitMessage(
      "tenant:tenant-2:events",
      JSON.stringify({ event: "message.created", data: { messageId: "wrong" } })
    );
    redis.emitMessage(
      "tenant:tenant-1:events",
      JSON.stringify({ event: "message.created", data: { messageId: "right" } })
    );
    subscription.unsubscribe();

    expect(redis.subscribe).toHaveBeenCalledWith("tenant:tenant-1:events");
    expect(received).toEqual([
      {
        type: "message.created",
        data: { messageId: "right" }
      }
    ]);
  });
});
