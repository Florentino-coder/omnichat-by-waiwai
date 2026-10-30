import { BadRequestException, ConflictException, HttpException, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PlanLimitExceededException } from "../common/exceptions/plan-limit-exceeded.exception";
import { PrismaService } from "../prisma/prisma.service";
import { ConnectClient } from "./connect.client";
import { ConnectionsService } from "./connections.service";

jest.mock("../knowledge/knowledge-url.util", () => ({
  ...jest.requireActual("../knowledge/knowledge-url.util"),
  assertResolvesToPublicAddress: jest.fn().mockResolvedValue(undefined)
}));

const stored = {
  id: "conn-1",
  tenantId: "tenant-1",
  name: "Shop",
  baseUrl: "https://shop.test/api",
  keyId: "ck_1",
  encryptedSecret: "enc:cs_current",
  encryptedPreviousSecret: null as string | null,
  previousSecretExpiresAt: null as Date | null,
  lastTestedAt: null,
  lastTestOk: true,
  suspendedAt: null as Date | null,
  suspendedReason: null as string | null,
  createdAt: new Date("2026-10-30"),
  updatedAt: new Date("2026-10-30"),
  deletedAt: null
};

const createDeps = () => {
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ planId: "pro" }) },
    planLimit: { findUnique: jest.fn().mockResolvedValue({ maxIntegrations: 3 }) },
    integrationConnection: {
      findFirst: jest.fn().mockResolvedValue(stored),
      // Calls: suspended connections first, then the plan limit count.
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...stored, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 })
    },
    auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) }
  };
  const client = {
    health: jest.fn().mockResolvedValue(undefined),
    rejectsBadSignature: jest.fn().mockResolvedValue(true),
    lookupCustomers: jest.fn().mockResolvedValue([{ id: "c1" }]),
    getOrder: jest.fn().mockResolvedValue({ order: { orderNumber: "GT1234" }, customer: null })
  };
  const service = new ConnectionsService(
    prisma as unknown as PrismaService,
    {
      encrypt: (value: string) => `enc:${value}`,
      decrypt: (value: string) => value.replace("enc:", "")
    } as unknown as CryptoSecretService,
    client as unknown as ConnectClient
  );
  return { prisma, client, service };
};

const lastAudit = (prisma: ReturnType<typeof createDeps>["prisma"]) =>
  (prisma.auditLog.create.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> }).data;

describe("ConnectionsService", () => {
  describe("create", () => {
    it("generates credentials, stores the secret encrypted, and returns it once", async () => {
      const { prisma, service } = createDeps();

      const result = await service.create("tenant-1", "user-1", " Shop ", "https://shop.test/api/");

      expect(result.secret).toMatch(/^cs_/);
      expect(result.keyId).toMatch(/^ck_[0-9a-f]{24}$/);
      const { data } = prisma.integrationConnection.create.mock.calls[0][0];
      expect(data).toMatchObject({
        tenantId: "tenant-1",
        name: "Shop",
        baseUrl: "https://shop.test/api",
        encryptedSecret: `enc:${result.secret}`
      });
      expect(lastAudit(prisma).action).toBe(AuditAction.INTEGRATION_CONNECTED);
      expect(JSON.stringify(lastAudit(prisma))).not.toContain(result.secret);
    });

    it.each([
      "http://shop.test",
      "https://localhost/api",
      "https://169.254.169.254/latest",
      "https://user:pass@shop.test",
      "https://shop.test/api?x=1"
    ])("rejects unsafe URL %s", async (url) => {
      const { prisma, service } = createDeps();
      await expect(service.create("tenant-1", "user-1", "Shop", url)).rejects.toBeInstanceOf(
        BadRequestException
      );
      expect(prisma.integrationConnection.create).not.toHaveBeenCalled();
    });

    it("enforces and audits the plan limit", async () => {
      const { prisma, service } = createDeps();
      prisma.planLimit.findUnique.mockResolvedValue({ maxIntegrations: 0 });

      await expect(
        service.create("tenant-1", "user-1", "Shop", "https://shop.test")
      ).rejects.toBeInstanceOf(PlanLimitExceededException);

      expect(prisma.integrationConnection.create).not.toHaveBeenCalled();
      expect(lastAudit(prisma).action).toBe(AuditAction.PLAN_LIMIT_EXCEEDED);
    });

    it("asks to disconnect first on a one-connection plan", async () => {
      const { prisma, service } = createDeps();
      prisma.planLimit.findUnique.mockResolvedValue({ maxIntegrations: 1 });
      prisma.integrationConnection.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

      await expect(
        service.create("tenant-1", "user-1", "Shop", "https://shop.test")
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("suspension", () => {
    const suspended = { ...stored, suspendedAt: new Date(), suspendedReason: "Key leaked" };

    it("blocks lookups and tests, and reports not connected", async () => {
      const { client, prisma, service } = createDeps();
      prisma.integrationConnection.findFirst.mockResolvedValue(suspended);

      const lookup = await service.lookupCustomers("tenant-1", "user-1", "0812345678").catch((e: unknown) => e);
      expect((lookup as HttpException).getStatus()).toBe(403);
      expect(client.lookupCustomers).not.toHaveBeenCalled();

      await expect(service.test("tenant-1", "user-1")).rejects.toBeInstanceOf(HttpException);
      expect(client.health).not.toHaveBeenCalled();

      await expect(service.getStatus("tenant-1")).resolves.toEqual({ connected: false });
    });

    it("stops a tenant lifting a suspension by disconnecting and recreating", async () => {
      const { prisma, service } = createDeps();
      prisma.integrationConnection.count.mockResolvedValue(1);

      const error = await service
        .create("tenant-1", "user-1", "Shop", "https://shop.test")
        .catch((e: unknown) => e);

      expect((error as HttpException).getStatus()).toBe(403);
      expect(prisma.integrationConnection.count).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", suspendedAt: { not: null } }
      });
      expect(prisma.integrationConnection.create).not.toHaveBeenCalled();
    });
  });

  it("never exposes secrets when reading a connection", async () => {
    const { prisma, service } = createDeps();
    prisma.integrationConnection.findFirst.mockResolvedValue({
      ...stored,
      encryptedPreviousSecret: "enc:cs_old"
    });

    const view = await service.getConnection("tenant-1");

    expect(JSON.stringify(view)).not.toMatch(/cs_|enc:/);
    expect(prisma.integrationConnection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-1", deletedAt: null } })
    );
  });

  describe("test", () => {
    it("passes when health works and bad signatures are refused", async () => {
      const { prisma, service } = createDeps();

      await expect(service.test("tenant-1", "user-1")).resolves.toEqual({
        ok: true,
        signatureEnforced: true,
        errorCode: null
      });
      expect(prisma.integrationConnection.updateMany).toHaveBeenCalledWith({
        where: { id: "conn-1", tenantId: "tenant-1" },
        data: { lastTestedAt: expect.any(Date), lastTestOk: true }
      });
      expect(lastAudit(prisma).action).toBe(AuditAction.INTEGRATION_TESTED);
    });

    it("fails a system that accepts bad signatures", async () => {
      const { client, service } = createDeps();
      client.rejectsBadSignature.mockResolvedValue(false);

      await expect(service.test("tenant-1", "user-1")).resolves.toEqual({
        ok: false,
        signatureEnforced: false,
        errorCode: "CONNECT_SIGNATURE_NOT_ENFORCED"
      });
    });

    it("records the error code when the system is unreachable", async () => {
      const { client, prisma, service } = createDeps();
      client.health.mockRejectedValue(
        new HttpException({ error: { code: "CONNECT_UNAVAILABLE" } }, 502)
      );

      const result = await service.test("tenant-1", "user-1");

      expect(result).toMatchObject({ ok: false, errorCode: "CONNECT_UNAVAILABLE" });
      expect(prisma.integrationConnection.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lastTestOk: false }) })
      );
    });
  });

  describe("rotateSecret", () => {
    it("keeps the old secret for 24 hours and returns the new one once", async () => {
      const { prisma, service } = createDeps();

      const result = await service.rotateSecret("tenant-1", "user-1");

      const { where, data } = prisma.integrationConnection.updateMany.mock.calls[0][0];
      expect(where).toEqual({ id: "conn-1", tenantId: "tenant-1" });
      expect(data.encryptedSecret).toBe(`enc:${result.secret}`);
      expect(data.encryptedPreviousSecret).toBe("enc:cs_current");
      const ttl = data.previousSecretExpiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(lastAudit(prisma).action).toBe(AuditAction.INTEGRATION_SECRET_ROTATED);
    });

    it("signs with both secrets during the overlap, then only the new one", async () => {
      const { client, prisma, service } = createDeps();
      prisma.integrationConnection.findFirst.mockResolvedValueOnce({
        ...stored,
        encryptedPreviousSecret: "enc:cs_old",
        previousSecretExpiresAt: new Date(Date.now() + 60_000)
      });
      await service.lookupCustomers("tenant-1", "user-1", "0812345678");
      expect(client.lookupCustomers.mock.calls[0][0].secrets).toEqual(["cs_current", "cs_old"]);

      prisma.integrationConnection.findFirst.mockResolvedValueOnce({
        ...stored,
        encryptedPreviousSecret: "enc:cs_old",
        previousSecretExpiresAt: new Date(Date.now() - 60_000)
      });
      await service.lookupCustomers("tenant-1", "user-1", "0812345678");
      expect(client.lookupCustomers.mock.calls[1][0].secrets).toEqual(["cs_current"]);
    });
  });

  it("soft deletes on disconnect, scoped to the tenant", async () => {
    const { prisma, service } = createDeps();

    await service.disconnect("tenant-1", "user-1");

    expect(prisma.integrationConnection.updateMany).toHaveBeenCalledWith({
      where: { id: "conn-1", tenantId: "tenant-1" },
      data: { deletedAt: expect.any(Date) }
    });
    expect(lastAudit(prisma).action).toBe(AuditAction.INTEGRATION_DISCONNECTED);
  });

  it("returns 404 when managing a missing connection", async () => {
    const { prisma, service } = createDeps();
    prisma.integrationConnection.findFirst.mockResolvedValue(null);
    await expect(service.test("tenant-1", "user-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  describe("lookups", () => {
    it("audits a masked phone only", async () => {
      const { prisma, service } = createDeps();

      await service.lookupCustomers("tenant-1", "user-1", "0812345678");

      const audit = lastAudit(prisma);
      expect(audit.action).toBe(AuditAction.INTEGRATION_LOOKUP);
      expect(audit.metadata).toMatchObject({ phone: "***5678", matches: 1 });
      expect(JSON.stringify(audit)).not.toContain("0812345678");
    });

    it("refuses lookups until the connection passes its test", async () => {
      const { client, prisma, service } = createDeps();
      prisma.integrationConnection.findFirst.mockResolvedValue({ ...stored, lastTestOk: false });

      const error = await service.getOrder("tenant-1", "user-1", "GT1234").catch((e: unknown) => e);

      expect((error as HttpException).getStatus()).toBe(409);
      expect(client.getOrder).not.toHaveBeenCalled();
    });

    it("reports connected only after a passed test", async () => {
      const { prisma, service } = createDeps();
      await expect(service.getStatus("tenant-1")).resolves.toEqual({ connected: true });

      prisma.integrationConnection.findFirst.mockResolvedValue({ ...stored, lastTestOk: false });
      await expect(service.getStatus("tenant-1")).resolves.toEqual({ connected: false });
    });
  });
});
