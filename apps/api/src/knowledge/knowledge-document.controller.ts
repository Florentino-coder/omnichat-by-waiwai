import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { KnowledgeDocument, Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { CreateKnowledgeDocumentDto } from "./dto/create-knowledge-document.dto";
import { KnowledgeDocumentService } from "./knowledge-document.service";

@Controller("knowledge/documents")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class KnowledgeDocumentController {
  constructor(private readonly knowledgeDocumentService: KnowledgeDocumentService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT, Role.QC, Role.VIEWER)
  listDocuments(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query("lineChannelId") lineChannelId?: string
  ): Promise<KnowledgeDocument[]> {
    return this.knowledgeDocumentService.listDocuments(ctx.tenantId, lineChannelId);
  }

  @Get(":id")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT, Role.QC, Role.VIEWER)
  findOne(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<KnowledgeDocument> {
    return this.knowledgeDocumentService.findOne(ctx.tenantId, id);
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT)
  createDocument(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: CreateKnowledgeDocumentDto
  ): Promise<KnowledgeDocument> {
    return this.knowledgeDocumentService.createDocument(ctx.tenantId, ctx.sub, dto);
  }

  @Post(":id/reindex")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT)
  reindexDocument(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<KnowledgeDocument> {
    return this.knowledgeDocumentService.reindexDocument(ctx.tenantId, ctx.sub, id);
  }

  @Delete(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  deleteDocument(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<KnowledgeDocument> {
    return this.knowledgeDocumentService.deleteDocument(
      ctx.tenantId,
      ctx.sub,
      ctx.role,
      id
    );
  }
}
