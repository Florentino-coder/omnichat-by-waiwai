import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { KnowledgeDocument, Role } from "@prisma/client";
import { memoryStorage } from "multer";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { CreateKnowledgeDocumentDto } from "./dto/create-knowledge-document.dto";
import { CreateKnowledgeDocumentFromUrlDto } from "./dto/create-knowledge-document-from-url.dto";
import { KnowledgeDocumentService } from "./knowledge-document.service";
import { UploadedKnowledgeFile } from "./knowledge-upload.types";

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

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT)
  createDocument(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: CreateKnowledgeDocumentDto
  ): Promise<KnowledgeDocument> {
    return this.knowledgeDocumentService.createDocument(ctx.tenantId, ctx.sub, dto);
  }

  @Post("upload")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  uploadDocument(
    @TenantCtx() ctx: JwtTenantPayload,
    @UploadedFile() file: UploadedKnowledgeFile,
    @Body("title") title: string,
    @Body("lineChannelId") lineChannelId?: string
  ): Promise<KnowledgeDocument> {
    return this.knowledgeDocumentService.createFromUpload(
      ctx.tenantId,
      ctx.sub,
      file,
      title,
      lineChannelId || undefined
    );
  }

  @Post("from-url")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT)
  createFromUrl(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: CreateKnowledgeDocumentFromUrlDto
  ): Promise<KnowledgeDocument> {
    return this.knowledgeDocumentService.createFromUrl(ctx.tenantId, ctx.sub, dto);
  }

  @Get(":id")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT, Role.QC, Role.VIEWER)
  findOne(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<KnowledgeDocument> {
    return this.knowledgeDocumentService.findOne(ctx.tenantId, id);
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
