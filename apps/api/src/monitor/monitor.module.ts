import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { MonitorController } from "./monitor.controller";
import { MonitorService } from "./monitor.service";
import { RedisModule } from "../redis/redis.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: "telemetry",
        ttl: 60_000,
        limit: 600
      }
    ]),
    RedisModule,
    AuthModule
  ],
  controllers: [MonitorController],
  providers: [MonitorService],
  exports: [MonitorService]
})
export class MonitorModule {}
