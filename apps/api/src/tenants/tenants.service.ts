import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, PlanLimit, Role, Tenant, TenantSettings } from "@prisma/client";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateTenantPlanDto } from "./dto/update-tenant-plan.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { UpdateTenantSettingsDto } from "./dto/update-tenant-settings.dto";

export interface TenantPlanSnapshot {
  tenant: Pick<Tenant, "id" | "planId" | "trialEndsAt">;
  limits: PlanLimit;
  usage: {
    workspaces: number;
    agents: number;
  };
}

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenant(tenantId: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id: tenantId,
        deletedAt: null
      }
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    return tenant;
  }

  async updateTenant(tenantId: string, dto: UpdateTenantDto): Promise<Tenant> {
    await this.getTenant(tenantId);
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: dto
    });
  }

  async getSettings(tenantId: string): Promise<TenantSettings> {
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (!settings) {
      throw new NotFoundException("Tenant settings not found");
    }

    return settings;
  }

  async updateSettings(
    tenantId: string,
    dto: UpdateTenantSettingsDto
  ): Promise<TenantSettings> {
    await this.getTenant(tenantId);
    return this.prisma.tenantSettings.update({
      where: { tenantId },
      data: dto
    });
  }

  async getPlan(tenantId: string): Promise<TenantPlanSnapshot> {
    const tenant = await this.getTenant(tenantId);
    const limits = await this.getPlanLimit(tenant.planId);
    const [workspaces, agents] = await Promise.all([
      this.prisma.workspace.count({
        where: {
          tenantId,
          deletedAt: null
        }
      }),
      this.prisma.workspaceMember.count({
        where: {
          tenantId,
          isActive: true
        }
      })
    ]);

    return {
      tenant: {
        id: tenant.id,
        planId: tenant.planId,
        trialEndsAt: tenant.trialEndsAt
      },
      limits,
      usage: {
        workspaces,
        agents
      }
    };
  }

  async updatePlan(
    tenantId: string,
    userId: string,
    dto: UpdateTenantPlanDto
  ): Promise<TenantPlanSnapshot> {
    const tenant = await this.getTenant(tenantId);
    await this.getPlanLimit(dto.planId);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { planId: dto.planId }
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.PLAN_CHANGED,
        targetType: "Tenant",
        targetId: tenantId,
        metadata: {
          oldPlanId: tenant.planId,
          newPlanId: dto.planId
        }
      }
    });
    return this.getPlan(tenantId);
  }

  async createTenant(userId: string, name: string): Promise<Tenant> {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "tenant";
    const uniqueSlug = `${slug}-${randomBytes(4).toString("hex")}`;

    const tenant = await this.prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name,
          slug: uniqueSlug,
          planId: "free",
        }
      });

      await tx.tenantSettings.create({
        data: {
          tenantId: newTenant.id,
          defaultLanguage: "th",
          timezone: "Asia/Bangkok",
        }
      });

      const workspace = await tx.workspace.create({
        data: {
          tenantId: newTenant.id,
          name: "General",
          isDefault: true,
        }
      });

      await tx.workspaceMember.create({
        data: {
          tenantId: newTenant.id,
          workspaceId: workspace.id,
          userId,
          role: Role.OWNER,
          isActive: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: newTenant.id,
          userId,
          action: AuditAction.TENANT_CREATED,
          targetType: "Tenant",
          targetId: newTenant.id,
          metadata: {
            name,
            slug: uniqueSlug
          }
        }
      });

      return newTenant;
    });

    return tenant;
  }

  private async getPlanLimit(planId: string): Promise<PlanLimit> {
    const limits = await this.prisma.planLimit.findUnique({
      where: { planId }
    });

    if (!limits) {
      throw new NotFoundException("Plan limit not found");
    }

    return limits;
  }
}
