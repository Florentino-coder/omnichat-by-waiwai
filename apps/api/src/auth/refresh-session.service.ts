import { Injectable } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";
import { RefreshSessionMetadata } from "./types/refresh-session.types";

const REFRESH_SESSION_TTL_SECONDS = 604800;

@Injectable()
export class RefreshSessionService {
  constructor(private readonly redisService: RedisService) {}

  async store(tokenHash: string, metadata: RefreshSessionMetadata): Promise<void> {
    const key = this.sessionKey(tokenHash);
    await this.redisService.client.set(
      key,
      JSON.stringify(metadata),
      "EX",
      REFRESH_SESSION_TTL_SECONDS
    );
    const userKey = this.userKey(metadata.userId);
    await this.redisService.client.sadd(userKey, key);
  }

  async get(tokenHash: string): Promise<RefreshSessionMetadata | null> {
    const value = await this.redisService.client.get(this.sessionKey(tokenHash));
    return value ? (JSON.parse(value) as RefreshSessionMetadata) : null;
  }

  async delete(tokenHash: string, userId?: string): Promise<void> {
    const key = this.sessionKey(tokenHash);
    await this.redisService.client.del(key);
    if (userId) {
      await this.redisService.client.srem(this.userKey(userId), key);
    }
  }

  async deleteAllForUser(userId: string): Promise<void> {
    const userKey = this.userKey(userId);
    const keys = await this.redisService.client.smembers(userKey);
    await this.redisService.client.del([...keys, userKey]);
  }

  private sessionKey(tokenHash: string): string {
    return `refresh:${tokenHash}`;
  }

  private userKey(userId: string): string {
    return `refresh:user:${userId}`;
  }
}
