import bcrypt from "bcryptjs";
import { AuditAction, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const seedTenant = {
  name: "Test Tenant",
  slug: "test-tenant",
} as const;

const seedWorkspace = {
  name: "Default Workspace",
  description: "Default workspace for the Stage 1 test tenant.",
} as const;

const seedOwner = {
  email: "owner@omnichat.local",
  displayName: "Test Owner",
  password: "ChangeMe123!",
} as const;

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(seedOwner.password, 12);

  const tenant = await prisma.tenant.upsert({
    where: { slug: seedTenant.slug },
    update: {
      name: seedTenant.name,
      isActive: true,
      deletedAt: null,
    },
    create: {
      name: seedTenant.name,
      slug: seedTenant.slug,
      isActive: true,
    },
  });

  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: {
      defaultLanguage: "th",
      timezone: "Asia/Bangkok",
      enableTwoFa: false,
      maxAgents: 10,
    },
    create: {
      tenantId: tenant.id,
      defaultLanguage: "th",
      timezone: "Asia/Bangkok",
      enableTwoFa: false,
      maxAgents: 10,
    },
  });

  const existingWorkspace = await prisma.workspace.findFirst({
    where: {
      tenantId: tenant.id,
      name: seedWorkspace.name,
    },
  });

  const workspace = existingWorkspace
    ? await prisma.workspace.update({
        where: { id: existingWorkspace.id },
        data: {
          description: seedWorkspace.description,
          isDefault: true,
          deletedAt: null,
        },
      })
    : await prisma.workspace.create({
        data: {
          tenantId: tenant.id,
          name: seedWorkspace.name,
          description: seedWorkspace.description,
          isDefault: true,
        },
      });

  const owner = await prisma.user.upsert({
    where: { email: seedOwner.email },
    update: {
      displayName: seedOwner.displayName,
      passwordHash,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      isActive: true,
      deletedAt: null,
    },
    create: {
      email: seedOwner.email,
      passwordHash,
      displayName: seedOwner.displayName,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      isActive: true,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: owner.id,
      },
    },
    update: {
      tenantId: tenant.id,
      role: Role.OWNER,
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      workspaceId: workspace.id,
      userId: owner.id,
      role: Role.OWNER,
      isActive: true,
    },
  });

  const existingAuditLog = await prisma.auditLog.findFirst({
    where: {
      tenantId: tenant.id,
      userId: owner.id,
      action: AuditAction.TENANT_CREATED,
      targetType: "Tenant",
      targetId: tenant.id,
    },
  });

  if (!existingAuditLog) {
    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: owner.id,
        action: AuditAction.TENANT_CREATED,
        targetType: "Tenant",
        targetId: tenant.id,
        metadata: {
          source: "stage-1-seed",
        },
      },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
