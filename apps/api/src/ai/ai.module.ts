import { Module } from "@nestjs/common";
import { LlmModule } from "../common/llm/llm.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ScenarioModule } from "../scenario/scenario.module";
import { AiReplyGeneratorService } from "./ai-reply-generator.service";

@Module({
  imports: [PrismaModule, LlmModule, KnowledgeModule, ScenarioModule],
  providers: [AiReplyGeneratorService],
  exports: [AiReplyGeneratorService]
})
export class AiModule {}
