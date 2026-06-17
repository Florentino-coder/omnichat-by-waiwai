import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTenantOwnerDto } from "./dto/create-tenant-owner.dto";
import { AuditAction, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      planId: t.planId,
      isActive: t.isActive,
      createdAt: t.createdAt,
      userCount: t._count.users
    }));
  }

  async createTenantWithOwner(superOwnerId: string, dto: CreateTenantOwnerDto) {
    // Check if user email already exists
    const existingUserByEmail = await this.prisma.user.findUnique({
      where: { email: dto.ownerEmail }
    });
    if (existingUserByEmail) {
      throw new ConflictException("User with this email already exists");
    }

    // Check if user username already exists (if provided)
    if (dto.ownerUsername) {
      const existingUserByUsername = await this.prisma.user.findUnique({
        where: { username: dto.ownerUsername }
      });
      if (existingUserByUsername) {
        throw new ConflictException("User with this username already exists");
      }
    }

    // Generate unique slug for tenant
    const slugBase = dto.tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "tenant";
    const uniqueSlug = `${slugBase}-${randomBytes(4).toString("hex")}`;

    // Hash the owner password
    const passwordHash = await bcrypt.hash(dto.ownerPassword, 12);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          slug: uniqueSlug,
          planId: "free"
        }
      });

      // 2. Create TenantSettings
      await tx.tenantSettings.create({
        data: {
          tenantId: tenant.id,
          defaultLanguage: "th",
          timezone: "Asia/Bangkok"
        }
      });

      // 3. Create Workspace
      const workspace = await tx.workspace.create({
        data: {
          tenantId: tenant.id,
          name: "General",
          isDefault: true
        }
      });

      // 4. Create Owner User
      const user = await tx.user.create({
        data: {
          email: dto.ownerEmail,
          username: dto.ownerUsername || null,
          passwordHash,
          displayName: dto.ownerDisplayName,
          emailVerified: true
        }
      });

      // 5. Link User as OWNER in the Workspace
      await tx.workspaceMember.create({
        data: {
          tenantId: tenant.id,
          workspaceId: workspace.id,
          userId: user.id,
          role: Role.OWNER,
          isActive: true
        }
      });

      // 6. Create Audit Log for Tenant Creation (linked to the new tenant, created by the superowner)
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: superOwnerId,
          action: AuditAction.TENANT_CREATED,
          targetType: "Tenant",
          targetId: tenant.id,
          metadata: {
            name: dto.tenantName,
            slug: uniqueSlug,
            ownerEmail: dto.ownerEmail,
            ownerDisplayName: dto.ownerDisplayName
          }
        }
      });

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug
        },
        workspace: {
          id: workspace.id,
          name: workspace.name
        },
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName
        }
      };
    });
  }
}
