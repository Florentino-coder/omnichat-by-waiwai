import { JwtService } from "@nestjs/jwt";
import { AuditAction, PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";

export interface FixtureUser {
  id: string;
  email: string;
  role: Role;
  accessToken: string;
}

export interface TenantFixture {
  tenantId: string;
  workspaceId: string;
  users: Record<Role, FixtureUser>;
  invitationId: string;
  auditLogId: string;
}

export interface Stage1Fixtures {
  tenantA: TenantFixture;
  tenantB: TenantFixture;
  signAccessToken(input: {
    userId: string;
    email: string;
    tenantId: string;
    workspaceId: string;
    role: Role;
  }): string;
}

const roles: Role[] = [Role.OWNER, Role.ADMIN, Role.AGENT, Role.QC, Role.VIEWER];

export async function resetStage1Data(prisma: PrismaClient): Promise<void> {
  const dbUrl = process.env.DATABASE_URL || "";
  const directUrl = process.env.DIRECT_URL || "";
  
  const isCloud = 
    dbUrl.includes("supabase.com") || 
    dbUrl.includes("aws-") || 
    directUrl.includes("supabase.com") || 
    directUrl.includes("aws-");
    
  const isLocal = 
    dbUrl.includes("localhost") || 
    dbUrl.includes("127.0.0.1") || 
    dbUrl.includes("postgres") && !isCloud;

  if (isCloud || !isLocal) {
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ":****@");
    throw new Error(
      `CRITICAL SAFETY WARNING: Integration tests are blocked from running on non-local databases to prevent data loss.\n` +
      `Detected DATABASE_URL: ${maskedUrl}\n` +
      `Please use a local database (e.g. running 'npm run docker:up') for running automated tests.`
    );
  }

  await prisma.message.deleteMany();
  await prisma.aiSuggestion.deleteMany();
  await prisma.knowledgeChunk.deleteMany();
  await prisma.knowledgeDocument.deleteMany();
  await prisma.knowledgeArticle.deleteMany();
  await prisma.automationRun.deleteMany();
  await prisma.automationRule.deleteMany();
  await prisma.aiScenario.deleteMany();
  await prisma.savedReply.deleteMany();
  await prisma.conversationInternalNote.deleteMany();
  await prisma.conversationTagLink.deleteMany();
  await prisma.conversationTag.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.customerChannel.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.promptTemplate.deleteMany();
  await prisma.lineChannel.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.tenantSettings.deleteMany();
  await prisma.usageCounter.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
  await prisma.planLimit.deleteMany();
}

export async function createStage1Fixtures(
  prisma: PrismaClient
): Promise<Stage1Fixtures> {
  await resetStage1Data(prisma);
  await seedPlanLimits(prisma);

  const jwt = new JwtService();
  const tenantA = await createTenantFixture(prisma, jwt, {
    name: "Tenant A",
    slug: "tenant-a",
    emailPrefix: "tenant-a"
  });
  const tenantB = await createTenantFixture(prisma, jwt, {
    name: "Tenant B",
    slug: "tenant-b",
    emailPrefix: "tenant-b"
  });

  return {
    tenantA,
    tenantB,
    signAccessToken: (input) =>
      jwt.sign(
        {
          sub: input.userId,
          email: input.email,
          tenantId: input.tenantId,
          workspaceId: input.workspaceId,
          role: input.role
        },
        { secret: requiredJwtSecret(), expiresIn: "15m" }
      )
  };
}

async function seedPlanLimits(prisma: PrismaClient): Promise<void> {
  await prisma.planLimit.createMany({
    data: [
      { planId: "free", maxWorkspaces: 1, maxAgents: 2, maxAiCreditsPerMonth: 0 },
      {
        planId: "starter",
        maxWorkspaces: 3,
        maxAgents: 10,
        maxAiCreditsPerMonth: 1000
      },
      { planId: "pro", maxWorkspaces: 10, maxAgents: 50, maxAiCreditsPerMonth: 10000 },
      {
        planId: "enterprise",
        maxWorkspaces: 100,
        maxAgents: 1000,
        maxAiCreditsPerMonth: 100000
      }
    ]
  });
}

async function createTenantFixture(
  prisma: PrismaClient,
  jwt: JwtService,
  options: { name: string; slug: string; emailPrefix: string }
): Promise<TenantFixture> {
  const tenant = await prisma.tenant.create({
    data: {
      name: options.name,
      slug: options.slug,
      planId: "starter",
      settings: {
        create: {
          defaultLanguage: "th",
          timezone: "Asia/Bangkok",
          maxAgents: 10
        }
      }
    }
  });
  const workspace = await prisma.workspace.create({
    data: {
      tenantId: tenant.id,
      name: `${options.name} Main`,
      isDefault: true
    }
  });
  const users = await createUsersForRoles(prisma, jwt, {
    tenantId: tenant.id,
    workspaceId: workspace.id,
    emailPrefix: options.emailPrefix
  });
  const invitation = await prisma.invitation.create({
    data: {
      tenantId: tenant.id,
      workspaceId: workspace.id,
      invitedByUserId: users[Role.OWNER].id,
      email: `${options.emailPrefix}-invite@omnichat.local`,
      role: Role.AGENT,
      token: `${options.emailPrefix}-invite-token`,
      expiresAt: new Date(Date.now() + 86_400_000)
    }
  });
  const auditLog = await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: users[Role.OWNER].id,
      action: AuditAction.TENANT_CREATED
    }
  });

  return {
    tenantId: tenant.id,
    workspaceId: workspace.id,
    users,
    invitationId: invitation.id,
    auditLogId: auditLog.id
  };
}

async function createUsersForRoles(
  prisma: PrismaClient,
  jwt: JwtService,
  options: { tenantId: string; workspaceId: string; emailPrefix: string }
): Promise<Record<Role, FixtureUser>> {
  const result = {} as Record<Role, FixtureUser>;
  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

  for (const role of roles) {
    const email = `${options.emailPrefix}-${role.toLowerCase()}@omnichat.local`;
    const user = await prisma.user.create({
      data: {
        email,
        username: `${options.emailPrefix}-${role.toLowerCase()}`,
        passwordHash,
        displayName: `${options.emailPrefix} ${role}`,
        emailVerified: true,
        memberships: {
          create: {
            tenantId: options.tenantId,
            workspaceId: options.workspaceId,
            role
          }
        }
      }
    });
    result[role] = {
      id: user.id,
      email,
      role,
      accessToken: jwt.sign(
        {
          sub: user.id,
          email,
          tenantId: options.tenantId,
          workspaceId: options.workspaceId,
          role
        },
        { secret: requiredJwtSecret(), expiresIn: "15m" }
      )
    };
  }

  return result;
}

function requiredJwtSecret(): string {
  return process.env.JWT_SECRET ?? "test-jwt-secret";
}
