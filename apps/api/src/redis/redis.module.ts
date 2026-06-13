import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { defaultRedisFactory, REDIS_FACTORY, RedisService } from "./redis.service";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_FACTORY,
      useValue: defaultRedisFactory
    },
    RedisService
  ],
  exports: [RedisService]
})
export class RedisModule {}
