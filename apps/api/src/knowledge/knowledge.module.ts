import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeDocumentController } from "./knowledge-document.controller";
import { KnowledgeDocumentService } from "./knowledge-document.service";
import { EmbeddingService } from "./embedding.service";
import { KnowledgeService } from "./knowledge.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [KnowledgeController, KnowledgeDocumentController],
  providers: [KnowledgeService, KnowledgeDocumentService, EmbeddingService],
  exports: [KnowledgeService, KnowledgeDocumentService]
})
export class KnowledgeModule {}
