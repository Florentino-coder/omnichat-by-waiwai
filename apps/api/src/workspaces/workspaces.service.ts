import { Injectable, NotFoundException } from "@nestjs/common";
import { Role, Workspace, WorkspaceMember } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
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
  constructor(private readonly prisma: PrismaService) {}

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

  create(tenantId: string, dto: CreateWorkspaceDto): Promise<Workspace> {
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
    userId: string
  ): Promise<WorkspaceMember> {
    const member = await this.findActiveMember(tenantId, workspaceId, userId);
    return this.prisma.workspaceMember.update({
      where: { id: member.id },
      data: { isActive: false }
    });
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
}
