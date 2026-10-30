import { HttpException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PrismaService } from "../prisma/prisma.service";
import { TermwaiClient } from "./termwai.client";
import { TermwaiService } from "./termwai.service";

const createDeps = () => {
  const prisma = {
    integrationCredential: {
      findFirst: jest.fn(),
      upsert: jest.fn().mockResolvedValue({ id: "cred-1", updatedAt: new Date("2026-10-30") }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 })
    },
    auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) }
  };
  const client = {
    ping: jest.fn().mockResolvedValue(undefined),
    lookupCustomers: jest.fn().mockResolvedValue([{ id: "c1" }]),
    getOrder: jest.fn().mockResolvedValue({ order: { orderNumber: "GT1234" }, customer: null })
  };
  const service = new TermwaiService(
    prisma as unknown as PrismaService,
    {
      encrypt: (value: string) => `enc:${value}`,
      decrypt: (value: string) => value.replace("enc:", "")
    } as unknown as CryptoSecretService,
    client as unknown as TermwaiClient
  );
  return { prisma, client, service };
};

const auditCall = (prisma: ReturnType<typeof createDeps>["prisma"]) =>
  prisma.auditLog.create.mock.calls[0][0] as { data: Record<string, unknown> };

describe("TermwaiService", () => {
  it("verifies, encrypts, and audits a key without logging it", async () => {
    const { prisma, client, service } = createDeps();

    const status = await service.connect("tenant-1", "user-1", "  twchat_secretKEY1  ");

    expect(client.ping).toHaveBeenCalledWith("twchat_secretKEY1");
    expect(prisma.integrationCredential.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_provider: { tenantId: "tenant-1", provider: "TERMWAI" } },
        update: expect.objectContaining({
          encryptedApiKey: "enc:twchat_secretKEY1",
          keyLast4: "KEY1",
          deletedAt: null
        })
      })
    );
    expect(status).toMatchObject({ connected: true, keyLast4: "KEY1" });
    expect(auditCall(prisma).data.action).toBe(AuditAction.INTEGRATION_CONNECTED);
    expect(JSON.stringify(auditCall(prisma))).not.toContain("secret");
  });

  it("does not save a key that Termwai rejects", async () => {
    const { prisma, client, service } = createDeps();
    client.ping.mockRejectedValue(new Error("rejected"));

    await expect(service.connect("tenant-1", "user-1", "twchat_bad")).rejects.toThrow("rejected");

    expect(prisma.integrationCredential.upsert).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("never returns the key in status", async () => {
    const { prisma, service } = createDeps();
    prisma.integrationCredential.findFirst.mockResolvedValue({
      encryptedApiKey: "enc:twchat_secret",
      keyLast4: "cret",
      updatedAt: new Date("2026-10-30")
    });

    const status = await service.getStatus("tenant-1");

    expect(status.connected).toBe(true);
    expect(JSON.stringify(status)).not.toContain("twchat_secret");
    expect(prisma.integrationCredential.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", provider: "TERMWAI", deletedAt: null }
    });
  });

  it("soft deletes on disconnect, scoped to the tenant", async () => {
    const { prisma, service } = createDeps();
    prisma.integrationCredential.findFirst.mockResolvedValue({ id: "cred-1" });

    await service.disconnect("tenant-1", "user-1");

    expect(prisma.integrationCredential.updateMany).toHaveBeenCalledWith({
      where: { id: "cred-1", tenantId: "tenant-1" },
      data: { deletedAt: expect.any(Date) }
    });
    expect(auditCall(prisma).data.action).toBe(AuditAction.INTEGRATION_DISCONNECTED);
  });

  it("uses the tenant's own decrypted key and audits a masked phone", async () => {
    const { prisma, client, service } = createDeps();
    prisma.integrationCredential.findFirst.mockResolvedValue({
      encryptedApiKey: "enc:twchat_tenantkey"
    });

    await service.lookupCustomers("tenant-1", "user-1", "0812345678");

    expect(client.lookupCustomers).toHaveBeenCalledWith("twchat_tenantkey", "0812345678");
    const audit = auditCall(prisma).data;
    expect(audit.action).toBe(AuditAction.INTEGRATION_LOOKUP);
    expect(audit.tenantId).toBe("tenant-1");
    expect(audit.metadata).toMatchObject({ phone: "***5678", matches: 1 });
    expect(JSON.stringify(audit)).not.toContain("0812345678");
  });

  it("returns 409 for lookups when Termwai is not connected", async () => {
    const { prisma, client, service } = createDeps();
    prisma.integrationCredential.findFirst.mockResolvedValue(null);

    const error = await service.getOrder("tenant-1", "user-1", "GT1234").catch((e: unknown) => e);

    expect((error as HttpException).getStatus()).toBe(409);
    expect(client.getOrder).not.toHaveBeenCalled();
  });
});
