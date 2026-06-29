import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AuditAction, Role, Workspace, WorkspaceMember } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PlanLimitExceededException } from "../common/exceptions/plan-limit-exceeded.exception";
import { RefreshSessionService } from "../auth/refresh-session.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminResetPasswordDto } from "./dto/admin-reset-password.dto";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";

type WorkspaceMemberWithUser = WorkspaceMember & {
  user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    isActive: boolean;
  };
};

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshSessionService: RefreshSessionService
  ) {}

  list(tenantId: string): Promise<Workspace[]> {
    return this.prisma.workspace.findMany({
      where: {
        tenantId,
        deletedAt: null
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
    });
  }

  async get(tenantId: string, workspaceId: string): Promise<Workspace> {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        tenantId,
        deletedAt: null
      }
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    return workspace;
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateWorkspaceDto
  ): Promise<Workspace> {
    await this.assertWorkspaceLimit(tenantId, userId);
    return this.prisma.workspace.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        isDefault: dto.isDefault ?? false
      }
    });
  }

  async update(
    tenantId: string,
    workspaceId: string,
    dto: UpdateWorkspaceDto
  ): Promise<Workspace> {
    await this.get(tenantId, workspaceId);
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: dto
    });
  }

  async softDelete(tenantId: string, workspaceId: string): Promise<Workspace> {
    await this.get(tenantId, workspaceId);
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        deletedAt: new Date()
      }
    });
  }

  async listMembers(
    tenantId: string,
    workspaceId: string
  ): Promise<WorkspaceMemberWithUser[]> {
    await this.get(tenantId, workspaceId);
    return this.prisma.workspaceMember.findMany({
      where: {
        tenantId,
        workspaceId,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isActive: true
          }
        }
      },
      orderBy: { joinedAt: "asc" }
    });
  }

  async updateMemberRole(
    tenantId: string,
    workspaceId: string,
    userId: string,
    role: Role
  ): Promise<WorkspaceMember> {
    const member = await this.findActiveMember(tenantId, workspaceId, userId);
    return this.prisma.workspaceMember.update({
      where: { id: member.id },
      data: { role }
    });
  }

  async removeMember(
    tenantId: string,
    workspaceId: string,
    userId: string,
    actorUserId: string
  ): Promise<WorkspaceMember> {
    if (userId === actorUserId) {
      throw new BadRequestException("Cannot remove yourself");
    }

    const member = await this.findActiveMember(tenantId, workspaceId, userId);

    if (member.role === Role.OWNER) {
      const ownerCount = await this.prisma.workspaceMember.count({
        where: {
          tenantId,
          isActive: true,
          role: Role.OWNER
        }
      });
      if (ownerCount <= 1) {
        throw new BadRequestException("Cannot remove the last owner in the tenant");
      }
    }

    const updated = await this.prisma.workspaceMember.update({
      where: { id: member.id },
      data: { isActive: false }
    });

    await this.revokeUserSessions(userId);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorUserId,
        action: AuditAction.USER_REMOVED,
        targetType: "User",
        targetId: userId,
        metadata: {
          workspaceId,
          removedRole: member.role
        }
      }
    });

    return updated;
  }

  async resetMemberPassword(
    tenantId: string,
    workspaceId: string,
    targetUserId: string,
    actorUserId: string,
    actorRole: Role,
    dto: AdminResetPasswordDto
  ): Promise<void> {
    if (targetUserId === actorUserId) {
      throw new BadRequestException("Cannot reset your own password");
    }

    const targetMember = await this.findActiveMember(tenantId, workspaceId, targetUserId);

    if (actorRole === Role.ADMIN && targetMember.role === Role.OWNER) {
      throw new ForbiddenException("Admins cannot reset owner passwords");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash }
    });

    await this.revokeUserSessions(targetUserId);

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorUserId,
        action: AuditAction.PASSWORD_CHANGED,
        targetType: "User",
        targetId: targetUserId,
        metadata: { source: "admin_reset", workspaceId }
      }
    });
  }

  private async revokeUserSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
    await this.refreshSessionService.deleteAllForUser(userId);
  }

  private async findActiveMember(
    tenantId: string,
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceMember> {
    await this.get(tenantId, workspaceId);
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        tenantId,
        workspaceId,
        userId,
        isActive: true
      }
    });

    if (!member) {
      throw new NotFoundException("Workspace member not found");
    }

    return member;
  }

  private async assertWorkspaceLimit(
    tenantId: string,
    userId: string
  ): Promise<void> {
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

    const workspaceCount = await this.prisma.workspace.count({
      where: {
        tenantId,
        deletedAt: null
      }
    });

    if (workspaceCount >= limits.maxWorkspaces) {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: AuditAction.PLAN_LIMIT_EXCEEDED,
          targetType: "Workspace",
          metadata: {
            planId: tenant.planId,
            limit: limits.maxWorkspaces,
            current: workspaceCount
          }
        }
      });
      throw new PlanLimitExceededException("Workspace limit exceeded", {
        planId: tenant.planId,
        limit: limits.maxWorkspaces,
        current: workspaceCount
      });
    }
  }
}
