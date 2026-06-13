import { INestApplication } from "@nestjs/common";
import { PrismaClient, Role } from "@prisma/client";
import request from "supertest";

jest.mock("otplib", () => ({
  OTP: class {
    generateSecret(): string {
      return "MOCKSECRET123456";
    }

    verifySync(options: { token: string }): { valid: boolean } {
      return { valid: options.token === "123456" };
    }

    generateURI(options: { issuer: string; label: string; secret: string }): string {
      return `otpauth://totp/${options.issuer}:${options.label}?secret=${options.secret}&issuer=${options.issuer}`;
    }
  }
}));

import { createApiTestApp } from "./helpers/api-test-app";
import { createStage1Fixtures, Stage1Fixtures } from "./helpers/stage-1-fixtures";

const allRoles: Role[] = [Role.OWNER, Role.ADMIN, Role.AGENT, Role.QC, Role.VIEWER];

describe("Stage 1 RBAC integration", () => {
  jest.setTimeout(120000);

  let app: INestApplication;
  let prisma: PrismaClient;
  let fixtures: Stage1Fixtures;

  beforeAll(async () => {
    app = await createApiTestApp();
    prisma = new PrismaClient();
    fixtures = await createStage1Fixtures(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  it("rejects protected tenant route without token", async () => {
    await request(app.getHttpServer()).get("/api/v1/tenants/me").expect(401);
  });

  it("allows every authenticated role to read current tenant", async () => {
    for (const role of allRoles) {
      await request(app.getHttpServer())
        .get("/api/v1/tenants/me")
        .set("Authorization", bearer(role))
        .expect(200);
    }
  });

  it("enforces tenant management RBAC", async () => {
    await expectAllowed("patch", "/api/v1/tenants/me", [Role.OWNER, Role.ADMIN], {
      name: "Tenant A Updated"
    });
    await expectAllowed("get", "/api/v1/tenants/me/settings", [Role.OWNER, Role.ADMIN]);
    await expectAllowed(
      "patch",
      "/api/v1/tenants/me/settings",
      [Role.OWNER, Role.ADMIN],
      { timezone: "Asia/Bangkok" }
    );
    await expectAllowed("get", "/api/v1/tenants/me/plan", [Role.OWNER, Role.ADMIN]);
    await expectAllowed("patch", "/api/v1/tenants/me/plan", [Role.OWNER], {
      planId: "pro"
    });
  });

  it("enforces workspace RBAC", async () => {
    const workspaceId = fixtures.tenantA.workspaceId;

    await expectAllowed("get", "/api/v1/workspaces", allRoles);
    await expectAllowed("post", "/api/v1/workspaces", [Role.OWNER, Role.ADMIN], {
      name: "Support"
    });
    await expectAllowed("patch", `/api/v1/workspaces/${workspaceId}`, [Role.OWNER, Role.ADMIN], {
      description: "Updated by RBAC test"
    });
    await expectAllowed("get", `/api/v1/workspaces/${workspaceId}/members`, allRoles);
    await expectWorkspaceDeleteAllowed([Role.OWNER]);
  });

  it("enforces invitation and audit-log RBAC", async () => {
    await expectAllowed("get", "/api/v1/invitations", [Role.OWNER, Role.ADMIN]);
    await expectAllowed("post", "/api/v1/invitations", [Role.OWNER, Role.ADMIN], {
      workspaceId: fixtures.tenantA.workspaceId,
      email: "new-agent@omnichat.local",
      role: Role.AGENT
    });
    await expectInvitationDeleteAllowed([Role.OWNER, Role.ADMIN]);
    await expectAllowed("get", "/api/v1/audit-logs", [Role.OWNER, Role.ADMIN]);
  });

  it("enforces inbox read RBAC", async () => {
    await expectAllowed("get", "/api/v1/inbox/conversations", [
      Role.OWNER,
      Role.ADMIN,
      Role.AGENT,
      Role.QC
    ]);
  });

  async function expectAllowed(
    method: "get" | "post" | "patch" | "delete",
    path: string,
    allowedRoles: Role[],
    body?: Record<string, unknown>
  ): Promise<void> {
    for (const role of allRoles) {
      const response = request(app.getHttpServer())[method](path).set(
        "Authorization",
        bearer(role)
      );
      if (body) {
        response.send(body);
      }
      const result = await response;
      if (allowedRoles.includes(role)) {
        expect(result.status).toBeGreaterThanOrEqual(200);
        expect(result.status).toBeLessThan(300);
      } else {
        expect(result.status).toBe(403);
      }
    }
  }

  function bearer(role: Role): string {
    return `Bearer ${fixtures.tenantA.users[role].accessToken}`;
  }

  async function expectWorkspaceDeleteAllowed(allowedRoles: Role[]): Promise<void> {
    for (const role of allRoles) {
      const workspace = await prisma.workspace.create({
        data: {
          tenantId: fixtures.tenantA.tenantId,
          name: `Delete ${role}`,
          isDefault: false
        }
      });

      const result = await request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspace.id}`)
        .set("Authorization", bearer(role));

      if (allowedRoles.includes(role)) {
        expect(result.status).toBeGreaterThanOrEqual(200);
        expect(result.status).toBeLessThan(300);
      } else {
        expect(result.status).toBe(403);
        await prisma.workspace.delete({ where: { id: workspace.id } });
      }
    }
  }

  async function expectInvitationDeleteAllowed(allowedRoles: Role[]): Promise<void> {
    for (const role of allRoles) {
      const invitation = await prisma.invitation.create({
        data: {
          tenantId: fixtures.tenantA.tenantId,
          workspaceId: fixtures.tenantA.workspaceId,
          invitedByUserId: fixtures.tenantA.users[Role.OWNER].id,
          email: `delete-${role.toLowerCase()}@omnichat.local`,
          role: Role.AGENT,
          token: `delete-${role.toLowerCase()}-${Date.now()}`,
          expiresAt: new Date(Date.now() + 86_400_000)
        }
      });

      const result = await request(app.getHttpServer())
        .delete(`/api/v1/invitations/${invitation.id}`)
        .set("Authorization", bearer(role));

      if (allowedRoles.includes(role)) {
        expect(result.status).toBeGreaterThanOrEqual(200);
        expect(result.status).toBeLessThan(300);
      } else {
        expect(result.status).toBe(403);
      }
    }
  }
});
