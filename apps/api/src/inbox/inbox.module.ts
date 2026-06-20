import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { LlmModule } from "../common/llm/llm.module";
import { InboxController } from "./inbox.controller";
import { InboxService } from "./inbox.service";

@Module({
  imports: [AuthModule, PrismaModule, RedisModule, LlmModule],
  controllers: [InboxController],
  providers: [InboxService]
})
export class InboxModule {}
