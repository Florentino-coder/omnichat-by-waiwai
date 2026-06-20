import bcrypt from "bcryptjs";
import { AuditAction, PrismaClient, Role } from "@prisma/client";
import { pathToFileURL } from "node:url";

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

const planLimits = [
  {
    planId: "free",
    maxWorkspaces: 1,
    maxAgents: 20,
    maxAiCreditsPerMonth: 0,
  },
  {
    planId: "starter",
    maxWorkspaces: 1,
    maxAgents: 50,
    maxAiCreditsPerMonth: 0,
  },
  {
    planId: "pro",
    maxWorkspaces: 3,
    maxAgents: 20,
    maxAiCreditsPerMonth: 0,
  },
  {
    planId: "enterprise",
    maxWorkspaces: 100,
    maxAgents: 1000,
    maxAiCreditsPerMonth: 0,
  },
] as const;

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(seedOwner.password, 12);

  for (const planLimit of planLimits) {
    await prisma.planLimit.upsert({
      where: { planId: planLimit.planId },
      update: planLimit,
      create: planLimit,
    });
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: seedTenant.slug },
    update: {
      name: seedTenant.name,
      planId: "free",
      isActive: true,
      deletedAt: null,
    },
    create: {
      name: seedTenant.name,
      slug: seedTenant.slug,
      planId: "free",
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
    update: buildExistingSeedOwnerUpdate(),
    create: {
      email: seedOwner.email,
      username: "owner",
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

  // Seed default prompt template
  const promptName = "suggested_reply_default";
  const defaultPrompt = `คุณเป็นผู้ช่วย Agent ร้านค้าที่กำลังตอบแชทลูกค้าผ่าน LINE OA

ชื่อลูกค้า: {{customer_name}}
แท็กลูกค้า: {{tags}}
โน้ตภายในทีม (ข้อมูลสำคัญ ห้ามฝ่าฝืนเด็ดขาด): {{notes}}

ประวัติการสนทนาล่าสุด:
{{conversation_history}}

คำสั่งสำหรับ action_type = {{action_type}}:
- generate: ร่างคำตอบใหม่ สุภาพ กระชับ ตรงประเด็น
- rewrite: เขียนใหม่ความหมายเดิมแต่สำนวนต่าง
- shorter: ย่อข้อความล่าสุดที่ agent พิมพ์ให้สั้นลง
- polite: ปรับให้สุภาพขึ้น
- friendly: ปรับให้เป็นกันเองขึ้น

ตอบเป็นข้อความเดียวที่พร้อมส่งจริง ไม่ต้องมีคำอธิบายเพิ่มเติม ไม่ต้องใส่ quote`;

  const existingPrompt = await prisma.promptTemplate.findFirst({
    where: {
      tenantId: null,
      name: promptName,
    },
  });

  if (existingPrompt) {
    await prisma.promptTemplate.update({
      where: { id: existingPrompt.id },
      data: {
        systemPrompt: defaultPrompt,
      },
    });
  } else {
    await prisma.promptTemplate.create({
      data: {
        tenantId: null,
        name: promptName,
        systemPrompt: defaultPrompt,
      },
    });
  }
}

export function buildExistingSeedOwnerUpdate(): {
  displayName: string;
  username: string;
  emailVerified: boolean;
  emailVerifiedAt: Date;
  isActive: boolean;
  deletedAt: null;
} {
  return {
    displayName: seedOwner.displayName,
    username: "owner",
    emailVerified: true,
    emailVerifiedAt: new Date(),
    isActive: true,
    deletedAt: null,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
