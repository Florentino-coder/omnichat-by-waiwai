import { Role } from "@prisma/client";
import { RedisService } from "../redis/redis.service";
import { RefreshSessionService } from "./refresh-session.service";
import { RefreshSessionMetadata } from "./types/refresh-session.types";

type MockRedisClient = {
  set: jest.Mock<Promise<unknown>, [string, string, string, number]>;
  get: jest.Mock<Promise<string | null>, [string]>;
  del: jest.Mock<Promise<unknown>, [string | string[]]>;
  sadd: jest.Mock<Promise<unknown>, [string, string]>;
  srem: jest.Mock<Promise<unknown>, [string, string]>;
  smembers: jest.Mock<Promise<string[]>, [string]>;
};

const createRedis = (): MockRedisClient => ({
  set: jest.fn<Promise<unknown>, [string, string, string, number]>().mockResolvedValue("OK"),
  get: jest.fn<Promise<string | null>, [string]>(),
  del: jest.fn<Promise<unknown>, [string | string[]]>().mockResolvedValue(1),
  sadd: jest.fn<Promise<unknown>, [string, string]>().mockResolvedValue(1),
  srem: jest.fn<Promise<unknown>, [string, string]>().mockResolvedValue(1),
  smembers: jest.fn<Promise<string[]>, [string]>()
});

const metadata: RefreshSessionMetadata = {
  userId: "user-1",
  tenantId: "tenant-1",
  workspaceId: "workspace-1",
  role: Role.OWNER,
  expiresAt: "2026-06-19T00:00:00.000Z"
};

describe("RefreshSessionService", () => {
  it("stores active refresh session metadata by token hash with seven day TTL", async () => {
    const client = createRedis();
    const service = new RefreshSessionService({ client } as unknown as RedisService);

    await service.store("token-hash", metadata);

    expect(client.set).toHaveBeenCalledWith(
      "refresh:token-hash",
      JSON.stringify(metadata),
      "EX",
      604800
    );
    expect(client.sadd).toHaveBeenCalledWith("refresh:user:user-1", "refresh:token-hash");
  });

  it("gets, deletes, and deletes all active refresh sessions for a user", async () => {
    const client = createRedis();
    client.get.mockResolvedValue(JSON.stringify(metadata));
    client.smembers.mockResolvedValue(["refresh:token-a", "refresh:token-b"]);
    const service = new RefreshSessionService({ client } as unknown as RedisService);

    await expect(service.get("token-hash")).resolves.toEqual(metadata);
    await service.delete("token-hash");
    await service.deleteAllForUser("user-1");

    expect(client.get).toHaveBeenCalledWith("refresh:token-hash");
    expect(client.del).toHaveBeenCalledWith("refresh:token-hash");
    expect(client.del).toHaveBeenCalledWith([
      "refresh:token-a",
      "refresh:token-b",
      "refresh:user:user-1"
    ]);
  });

  it("removes a deleted session from the user index when userId is provided", async () => {
    const client = createRedis();
    const service = new RefreshSessionService({ client } as unknown as RedisService);

    await service.delete("token-hash", "user-1");

    expect(client.del).toHaveBeenCalledWith("refresh:token-hash");
    expect(client.srem).toHaveBeenCalledWith("refresh:user:user-1", "refresh:token-hash");
  });
});
