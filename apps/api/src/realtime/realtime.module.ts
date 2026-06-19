import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RedisModule } from "../redis/redis.module";
import { RealtimeController } from "./realtime.controller";
import { RealtimeService } from "./realtime.service";
import { MonitorModule } from "../monitor/monitor.module";

@Module({
  imports: [AuthModule, RedisModule, MonitorModule],
  controllers: [RealtimeController],
  providers: [RealtimeService],
  exports: [RealtimeService]
})
export class RealtimeModule {}
