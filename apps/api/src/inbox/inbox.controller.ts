import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  Conversation,
  ConversationInternalNote,
  ConversationPriority,
  ConversationTag,
  ConversationTagLink,
  Message,
  Role,
  SavedReply
} from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantCtx } from "../auth/decorators/tenant-context.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { TenantGuard } from "../auth/guards/tenant.guard";
import { JwtTenantPayload } from "../auth/types/auth.types";
import { AssignConversationDto } from "./dto/assign-conversation.dto";
import { CreateConversationTagDto } from "./dto/create-conversation-tag.dto";
import { CreateInternalNoteDto } from "./dto/create-internal-note.dto";
import { CreateSavedReplyDto } from "./dto/create-saved-reply.dto";
import { RenameCustomerDto } from "./dto/rename-customer.dto";
import { UpdateConversationPriorityDto } from "./dto/update-conversation-priority.dto";
import { UpdateConversationTagDto } from "./dto/update-conversation-tag.dto";
import { UpdateConversationStatusDto } from "./dto/update-conversation-status.dto";
import { UpdateInboxSettingsDto } from "./dto/update-inbox-settings.dto";
import { UpdateSavedReplyDto } from "./dto/update-saved-reply.dto";
import { InboxConversation, InboxService, InboxSettings } from "./inbox.service";

@Controller("inbox")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InboxController {
  constructor(private readonly inboxService: InboxService) { }

  @Get("conversations")
  @Roles(Role.ADMIN, Role.AGENT, Role.QC)
  listConversations(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ): Promise<InboxConversation[]> {
    return this.inboxService.listConversations(ctx.tenantId, {
      limit: readPositiveInt(limit),
      offset: readPositiveInt(offset)
    });
  }

  @Get("settings")
  @Roles(Role.ADMIN, Role.AGENT, Role.QC)
  getSettings(@TenantCtx() ctx: JwtTenantPayload): Promise<InboxSettings> {
    return this.inboxService.getSettings(ctx.tenantId);
  }

  @Get("conversations/:id/messages")
  @Roles(Role.ADMIN, Role.AGENT, Role.QC)
  getConversationMessages(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<Message[]> {
    return this.inboxService.getConversationMessages(ctx.tenantId, id);
  }

  @Get("tags")
  @Roles(Role.ADMIN, Role.AGENT, Role.QC)
  listTags(@TenantCtx() ctx: JwtTenantPayload): Promise<ConversationTag[]> {
    return this.inboxService.listTags(ctx.tenantId);
  }

  @Post("tags")
  @Roles(Role.ADMIN)
  createTag(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: CreateConversationTagDto
  ): Promise<ConversationTag> {
    return this.inboxService.createTag(ctx.tenantId, ctx.sub, dto);
  }

  @Patch("tags/:tagId")
  @Roles(Role.ADMIN)
  updateTag(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("tagId") tagId: string,
    @Body() dto: UpdateConversationTagDto
  ): Promise<ConversationTag> {
    return this.inboxService.updateTag(ctx.tenantId, ctx.sub, tagId, dto);
  }

  @Delete("tags/:tagId")
  @Roles(Role.ADMIN)
  deleteTag(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("tagId") tagId: string
  ): Promise<ConversationTag> {
    return this.inboxService.deleteTag(ctx.tenantId, ctx.sub, tagId);
  }

  @Get("saved-replies")
  @Roles(Role.ADMIN, Role.AGENT, Role.QC)
  listSavedReplies(
    @TenantCtx() ctx: JwtTenantPayload,
    @Query("lineChannelId") lineChannelId?: string,
    @Query("type") type?: "all" | "shared" | "personal"
  ): Promise<SavedReply[]> {
    return this.inboxService.listSavedReplies(ctx.tenantId, {
      lineChannelId,
      userId: ctx.sub,
      type
    });
  }

  @Post("saved-replies")
  @Roles(Role.ADMIN, Role.AGENT, Role.QC)
  createSavedReply(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: CreateSavedReplyDto
  ): Promise<SavedReply> {
    if (!dto.userId && ctx.role !== Role.OWNER && ctx.role !== Role.ADMIN) {
      throw new ForbiddenException("Only administrators can create shared quick replies");
    }
    if (dto.userId && dto.userId !== ctx.sub) {
      throw new ForbiddenException("Cannot create personal quick replies for other users");
    }
    return this.inboxService.createSavedReply(ctx.tenantId, ctx.sub, {
      ...dto,
      userId: dto.userId || undefined
    });
  }

  @Patch("saved-replies/:replyId")
  @Roles(Role.ADMIN, Role.AGENT, Role.QC)
  updateSavedReply(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("replyId") replyId: string,
    @Body() dto: UpdateSavedReplyDto
  ): Promise<SavedReply> {
    return this.inboxService.updateSavedReply(ctx.tenantId, ctx.sub, ctx.role, replyId, dto);
  }

  @Delete("saved-replies/:replyId")
  @Roles(Role.ADMIN, Role.AGENT, Role.QC)
  deleteSavedReply(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("replyId") replyId: string
  ): Promise<SavedReply> {
    return this.inboxService.deleteSavedReply(ctx.tenantId, ctx.sub, ctx.role, replyId);
  }

  @Patch("conversations/:id/customer-name")
  @Roles(Role.ADMIN, Role.AGENT)
  renameCustomer(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: RenameCustomerDto
  ): Promise<Conversation> {
    return this.inboxService.renameCustomer(ctx.tenantId, ctx.sub, id, dto.nickname);
  }

  @Patch("conversations/:id/status")
  @Roles(Role.ADMIN, Role.AGENT)
  updateStatus(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: UpdateConversationStatusDto
  ): Promise<Conversation> {
    return this.inboxService.updateStatus(ctx.tenantId, ctx.sub, id, dto.status);
  }

  @Patch("conversations/:id/assignment")
  @Roles(Role.ADMIN, Role.AGENT)
  assignConversation(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: AssignConversationDto
  ): Promise<Conversation> {
    return this.inboxService.assignConversation(ctx.tenantId, ctx.sub, id, dto.memberId ?? null);
  }

  @Patch("conversations/:id/priority")
  @Roles(Role.ADMIN, Role.AGENT)
  updatePriority(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: UpdateConversationPriorityDto
  ): Promise<Conversation> {
    return this.inboxService.updatePriority(
      ctx.tenantId,
      ctx.sub,
      id,
      dto.priority as ConversationPriority
    );
  }

  @Post("conversations/:id/tags/:tagId")
  @Roles(Role.ADMIN, Role.AGENT)
  addConversationTag(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Param("tagId") tagId: string
  ): Promise<ConversationTagLink> {
    return this.inboxService.addConversationTag(ctx.tenantId, ctx.sub, id, tagId);
  }

  @Delete("conversations/:id/tags/:tagId")
  @Roles(Role.ADMIN, Role.AGENT)
  removeConversationTag(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Param("tagId") tagId: string
  ): Promise<ConversationTagLink> {
    return this.inboxService.removeConversationTag(ctx.tenantId, ctx.sub, id, tagId);
  }

  @Get("conversations/:id/notes")
  @Roles(Role.ADMIN, Role.AGENT, Role.QC)
  listNotes(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<ConversationInternalNote[]> {
    return this.inboxService.listNotes(ctx.tenantId, id);
  }

  @Post("conversations/:id/notes")
  @Roles(Role.ADMIN, Role.AGENT)
  createNote(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Body() dto: CreateInternalNoteDto
  ): Promise<ConversationInternalNote> {
    return this.inboxService.createNote(ctx.tenantId, ctx.sub, id, dto.body);
  }

  @Delete("conversations/:id/notes/:noteId")
  @Roles(Role.ADMIN, Role.AGENT)
  deleteNote(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string,
    @Param("noteId") noteId: string
  ): Promise<ConversationInternalNote> {
    return this.inboxService.deleteNote(ctx.tenantId, ctx.sub, ctx.role, id, noteId);
  }

  @Patch("settings")
  @Roles(Role.ADMIN)
  updateSettings(
    @TenantCtx() ctx: JwtTenantPayload,
    @Body() dto: UpdateInboxSettingsDto
  ): Promise<InboxSettings> {
    return this.inboxService.updateSettings(
      ctx.tenantId,
      ctx.sub,
      dto.inProgressAlertMinutes
    );
  }

  @Patch("conversations/:id/mark-as-read")
  @Roles(Role.ADMIN, Role.AGENT)
  async markAsRead(
    @TenantCtx() ctx: JwtTenantPayload,
    @Param("id") id: string
  ): Promise<{ success: boolean }> {
    await this.inboxService.markAsRead(ctx.tenantId, ctx.sub, id);
    return { success: true };
  }
}

function readPositiveInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
