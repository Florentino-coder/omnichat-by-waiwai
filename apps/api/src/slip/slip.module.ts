import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { LlmModule } from "../common/llm/llm.module";
import { RedisModule } from "../redis/redis.module";
import { SlipService } from "./slip.service";
import { SlipOkClient } from "./slipok.client";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    StorageModule,
    RealtimeModule,
    LlmModule,
    RedisModule,
  ],
  providers: [SlipService, SlipOkClient],
  exports: [SlipService, SlipOkClient],
})
export class SlipModule {}
