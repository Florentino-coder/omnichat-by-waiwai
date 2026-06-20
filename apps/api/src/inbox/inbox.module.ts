import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { LlmModule } from "../common/llm/llm.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { ScenarioModule } from "../scenario/scenario.module";
import { AutomationModule } from "../automation/automation.module";
import { InboxController } from "./inbox.controller";
import { InboxService } from "./inbox.service";

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    RedisModule,
    LlmModule,
    KnowledgeModule,
    ScenarioModule,
    AutomationModule
  ],
  controllers: [InboxController],
  providers: [InboxService]
})
export class InboxModule {}
