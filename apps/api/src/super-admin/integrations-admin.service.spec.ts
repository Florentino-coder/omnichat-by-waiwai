import { ConflictException, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { IntegrationsAdminService } from "./integrations-admin.service";

const createDeps = () => {
  const prisma = {
    integrationConnection: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({})
    },
    auditLog: {
      groupBy: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: "audit-1" })
    }
  };
  return { prisma, service: new IntegrationsAdminService(prisma as unknown as PrismaService) };
};

const connection = { id: "conn-1", tenantId: "tenant-1", keyId: "ck_1", suspendedAt: null };

describe("IntegrationsAdminService", () => {
  it("lists metadata and lookup counts without selecting secrets", async () => {
    const { prisma, service } = createDeps();
    prisma.integrationConnection.findMany.mockResolvedValue([
      {
        id: "conn-1",
        tenantId: "tenant-1",
        name: "Shop",
        tenant: { name: "Acme", planId: "pro" }
      },
      {
        id: "conn-2",
        tenantId: "tenant-2",
        name: "Other",
        tenant: { name: "Beta", planId: "free" }
      }
    ]);
    prisma.auditLog.groupBy.mockResolvedValue([{ tenantId: "tenant-1", _count: { _all: 12 } }]);

    const rows = await service.list();

    expect(rows[0]).toMatchObject({ tenantName: "Acme", planId: "pro", lookupsThisMonth: 12 });
    expect(rows[1].lookupsThisMonth).toBe(0);

    const { select } = prisma.integrationConnection.findMany.mock.calls[0][0];
    expect(select.encryptedSecret).toBeUndefined();
    expect(select.encryptedPreviousSecret).toBeUndefined();
    expect(JSON.stringify(rows)).not.toContain("tenant\":");
  });

  it("keeps suspended rows listed after a disconnect so they can be resumed", async () => {
    const { prisma, service } = createDeps();
    await service.list();
    expect(prisma.integrationConnection.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ deletedAt: null }, { suspendedAt: { not: null } }]
    });
  });

  it("suspends with a reason and audits under the connection's tenant", async () => {
    const { prisma, service } = createDeps();
    prisma.integrationConnection.findUnique.mockResolvedValue(connection);

    await service.suspend("owner-1", "conn-1", "  Key leaked  ");

    expect(prisma.integrationConnection.update).toHaveBeenCalledWith({
      where: { id: "conn-1" },
      data: { suspendedAt: expect.any(Date), suspendedReason: "Key leaked" }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        userId: "owner-1",
        action: AuditAction.INTEGRATION_SUSPENDED,
        targetType: "IntegrationConnection",
        targetId: "conn-1",
        metadata: { keyId: "ck_1", reason: "Key leaked" }
      }
    });
  });

  it("resumes and audits", async () => {
    const { prisma, service } = createDeps();
    prisma.integrationConnection.findUnique.mockResolvedValue({
      ...connection,
      suspendedAt: new Date()
    });

    await service.resume("owner-1", "conn-1");

    expect(prisma.integrationConnection.update).toHaveBeenCalledWith({
      where: { id: "conn-1" },
      data: { suspendedAt: null, suspendedReason: null }
    });
    expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe(AuditAction.INTEGRATION_RESUMED);
  });

  it("rejects invalid state changes and unknown connections", async () => {
    const { prisma, service } = createDeps();

    prisma.integrationConnection.findUnique.mockResolvedValue(connection);
    await expect(service.resume("owner-1", "conn-1")).rejects.toBeInstanceOf(ConflictException);

    prisma.integrationConnection.findUnique.mockResolvedValue({
      ...connection,
      suspendedAt: new Date()
    });
    await expect(service.suspend("owner-1", "conn-1", "again")).rejects.toBeInstanceOf(
      ConflictException
    );

    prisma.integrationConnection.findUnique.mockResolvedValue(null);
    await expect(service.suspend("owner-1", "missing", "reason")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
