import { Module, forwardRef } from "@nestjs/common";
import { LlmModule } from "../common/llm/llm.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { LineModule } from "../line/line.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { ScenarioModule } from "../scenario/scenario.module";
import { AuthModule } from "../auth/auth.module";
import { AiAutoReplyService } from "./ai-auto-reply.service";
import { AiReplyGeneratorService } from "./ai-reply-generator.service";
import { AiCurationController } from "./ai-curation.controller";
import { AiCurationService } from "./ai-curation.service";

@Module({
  imports: [
    PrismaModule,
    LlmModule,
    KnowledgeModule,
    ScenarioModule,
    RedisModule,
    AuthModule,
    forwardRef(() => LineModule)
  ],
  controllers: [AiCurationController],
  providers: [AiReplyGeneratorService, AiAutoReplyService, AiCurationService],
  exports: [AiReplyGeneratorService, AiAutoReplyService, AiCurationService]
})
export class AiModule {}
