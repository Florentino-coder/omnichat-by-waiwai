import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, Invitation, InvitationStatus, User } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { PlanLimitExceededException } from "../common/exceptions/plan-limit-exceeded.exception";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { CreatedInvitationResponse, InvitationWithContext } from "./types/invitation.types";

const INVITATION_EXPIRY_DAYS = 7;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService
  ) {}

  async create(
    tenantId: string,
    invitedByUserId: string,
    dto: CreateInvitationDto
  ): Promise<CreatedInvitationResponse> {
    const context = await this.assertWorkspaceInTenant(tenantId, dto.workspaceId);
    const token = this.createToken();
    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId,
        workspaceId: dto.workspaceId,
        invitedByUserId,
        email: dto.email.toLowerCase(),
        role: dto.role,
        token,
        expiresAt: this.expiresAt()
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: invitedByUserId,
        action: AuditAction.USER_INVITED,
        targetType: "Invitation",
        targetId: invitation.id,
        metadata: {
          email: invitation.email,
          role: invitation.role,
          workspaceId: invitation.workspaceId
        }
      }
    });

    try {
      await this.mailService.sendInvitationEmail({
        to: invitation.email,
        inviteToken: token,
        tenantName: context.tenantName,
        workspaceName: context.workspaceName,
        expiresAt: invitation.expiresAt
      });
    } catch (error) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.REVOKED }
      });
      throw error;
    }

    return {
      invitation,
      inviteToken: token
    };
  }

  list(tenantId: string): Promise<Invitation[]> {
    return this.prisma.invitation.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    });
  }

  async revoke(tenantId: string, invitationId: string): Promise<Invitation> {
    const invitation = await this.prisma.invitation.findFirst({
      where: {
        id: invitationId,
        tenantId
      }
    });

    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    return this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.REVOKED }
    });
  }

  async verify(token: string): Promise<InvitationWithContext> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        workspace: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new NotFoundException("Invitation not found");
    }

    if (invitation.expiresAt <= new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED }
      });
      throw new NotFoundException("Invitation expired");
    }

    return invitation;
  }

  async accept(token: string, dto: AcceptInvitationDto): Promise<User> {
    const invitation = await this.verify(token);
    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email }
    });

    if (existingUser) {
      throw new ConflictException("User already exists");
    }

    const normalizedUsername = dto.username.toLowerCase();
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: normalizedUsername }
    });

    if (existingUsername) {
      throw new ConflictException("Username is already taken");
    }

    await this.assertAgentLimit(invitation.tenantId);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          username: normalizedUsername,
          displayName: dto.displayName,
          passwordHash: await bcrypt.hash(dto.password, 12),
          emailVerified: true,
          emailVerifiedAt: new Date()
        }
      });

      await tx.workspaceMember.create({
        data: {
          tenantId: invitation.tenantId,
          workspaceId: invitation.workspaceId,
          userId: user.id,
          role: invitation.role
        }
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date()
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: invitation.tenantId,
          userId: user.id,
          action: AuditAction.USER_INVITED,
          targetType: "User",
          targetId: user.id,
          metadata: {
            acceptedInvitationId: invitation.id,
            workspaceId: invitation.workspaceId,
            role: invitation.role
          }
        }
      });

      return user;
    });
  }

  private async assertWorkspaceInTenant(
    tenantId: string,
    workspaceId: string
  ): Promise<{ tenantName: string; workspaceName: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true }
    });
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        tenantId,
        deletedAt: null
      }
    });

    if (!tenant || !workspace) {
      throw new NotFoundException("Workspace not found");
    }

    return {
      tenantName: tenant.name,
      workspaceName: workspace.name
    };
  }

  private async assertAgentLimit(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planId: true }
    });
    const limits = tenant
      ? await this.prisma.planLimit.findUnique({
          where: { planId: tenant.planId }
        })
      : null;

    if (!tenant || !limits) {
      throw new NotFoundException("Plan limit not found");
    }

    const activeMembers = await this.prisma.workspaceMember.findMany({
      where: {
        tenantId,
        isActive: true
      },
      select: {
        userId: true
      }
    });

    const uniqueUserIds = new Set(activeMembers.map((m) => m.userId));
    const activeCount = uniqueUserIds.size;

    if (activeCount >= limits.maxAgents) {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          action: AuditAction.PLAN_LIMIT_EXCEEDED,
          targetType: "WorkspaceMember",
          metadata: {
            planId: tenant.planId,
            limit: limits.maxAgents,
            current: activeCount
          }
        }
      });
      throw new PlanLimitExceededException("Agent limit exceeded", {
        planId: tenant.planId,
        limit: limits.maxAgents,
        current: activeCount
      });
    }
  }

  private createToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private expiresAt(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);
    return expiresAt;
  }
}
