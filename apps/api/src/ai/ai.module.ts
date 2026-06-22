import { Module, forwardRef } from "@nestjs/common";
import { LlmModule } from "../common/llm/llm.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { LineModule } from "../line/line.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { ScenarioModule } from "../scenario/scenario.module";
import { AuthModule } from "../auth/auth.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { AiAutoReplyService } from "./ai-auto-reply.service";
import { AiReplyGeneratorService } from "./ai-reply-generator.service";
import { AiCurationController } from "./ai-curation.controller";
import { AiCurationService } from "./ai-curation.service";
import { AiHybridDraftService } from "./ai-hybrid-draft.service";

@Module({
  imports: [
    PrismaModule,
    LlmModule,
    KnowledgeModule,
    ScenarioModule,
    RedisModule,
    AuthModule,
    RealtimeModule,
    forwardRef(() => LineModule)
  ],
  controllers: [AiCurationController],
  providers: [AiReplyGeneratorService, AiAutoReplyService, AiCurationService, AiHybridDraftService],
  exports: [AiReplyGeneratorService, AiAutoReplyService, AiCurationService, AiHybridDraftService]
})
export class AiModule {}
