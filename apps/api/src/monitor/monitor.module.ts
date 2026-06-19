import { Module } from "@nestjs/common";
import { MonitorController } from "./monitor.controller";
import { MonitorService } from "./monitor.service";
import { RedisModule } from "../redis/redis.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [RedisModule, AuthModule],
  controllers: [MonitorController],
  providers: [MonitorService],
  exports: [MonitorService]
})
export class MonitorModule {}
