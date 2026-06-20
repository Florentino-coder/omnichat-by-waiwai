import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { KnowledgeArticle, Role } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { CreateKnowledgeArticleDto } from "./dto/create-knowledge-article.dto";
import { ListKnowledgeArticlesDto } from "./dto/list-knowledge-articles.dto";
import { UpdateKnowledgeArticleDto } from "./dto/update-knowledge-article.dto";
import { KnowledgeService } from "./knowledge.service";

@Controller("knowledge/articles")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT, Role.QC, Role.VIEWER)
  listArticles(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query() query: ListKnowledgeArticlesDto
  ): Promise<KnowledgeArticle[]> {
    return this.knowledgeService.listArticles(ctx.tenantId, {
      lineChannelId: query.lineChannelId,
      search: query.search,
      limit: query.limit,
      activeOnly: false
    });
  }

  @Get(":id")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT, Role.QC, Role.VIEWER)
  findOne(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<KnowledgeArticle> {
    return this.knowledgeService.findOne(ctx.tenantId, id);
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT)
  createArticle(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: CreateKnowledgeArticleDto
  ): Promise<KnowledgeArticle> {
    return this.knowledgeService.createArticle(ctx.tenantId, ctx.sub, dto);
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN, Role.AGENT)
  updateArticle(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: UpdateKnowledgeArticleDto
  ): Promise<KnowledgeArticle> {
    return this.knowledgeService.updateArticle(
      ctx.tenantId,
      ctx.sub,
      ctx.role,
      id,
      dto
    );
  }

  @Delete(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  deleteArticle(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<KnowledgeArticle> {
    return this.knowledgeService.deleteArticle(
      ctx.tenantId,
      ctx.sub,
      ctx.role,
      id
    );
  }
}
