import { HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, IntegrationProvider } from "@prisma/client";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PrismaService } from "../prisma/prisma.service";
import { TermwaiClient, TermwaiCustomerDetail, TermwaiOrderDetail } from "./termwai.client";

export type TermwaiStatus = {
  connected: boolean;
  keyLast4: string | null;
  updatedAt: Date | null;
};

const maskPhone = (phone: string): string => `***${phone.replace(/\D/g, "").slice(-4)}`;

@Injectable()
export class TermwaiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoSecret: CryptoSecretService,
    private readonly client: TermwaiClient
  ) {}

  async getStatus(tenantId: string): Promise<TermwaiStatus> {
    const credential = await this.findCredential(tenantId);
    return {
      connected: Boolean(credential),
      keyLast4: credential?.keyLast4 ?? null,
      updatedAt: credential?.updatedAt ?? null
    };
  }

  async connect(tenantId: string, userId: string, apiKey: string): Promise<TermwaiStatus> {
    const key = apiKey.trim();
    await this.client.ping(key);

    const encryptedApiKey = this.cryptoSecret.encrypt(key);
    const keyLast4 = key.slice(-4);
    const credential = await this.prisma.integrationCredential.upsert({
      where: {
        tenantId_provider: { tenantId, provider: IntegrationProvider.TERMWAI }
      },
      create: { tenantId, provider: IntegrationProvider.TERMWAI, encryptedApiKey, keyLast4 },
      update: { encryptedApiKey, keyLast4, deletedAt: null }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.INTEGRATION_CONNECTED,
        targetType: "IntegrationCredential",
        targetId: credential.id,
        metadata: { provider: IntegrationProvider.TERMWAI, keyLast4 }
      }
    });

    return { connected: true, keyLast4, updatedAt: credential.updatedAt };
  }

  async disconnect(tenantId: string, userId: string): Promise<void> {
    const credential = await this.findCredential(tenantId);
    if (!credential) {
      throw new NotFoundException("Termwai is not connected");
    }

    await this.prisma.integrationCredential.updateMany({
      where: { id: credential.id, tenantId },
      data: { deletedAt: new Date() }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.INTEGRATION_DISCONNECTED,
        targetType: "IntegrationCredential",
        targetId: credential.id,
        metadata: { provider: IntegrationProvider.TERMWAI }
      }
    });
  }

  async lookupCustomers(
    tenantId: string,
    userId: string,
    phone: string
  ): Promise<TermwaiCustomerDetail[]> {
    const customers = await this.client.lookupCustomers(await this.apiKey(tenantId), phone);
    await this.auditLookup(tenantId, userId, {
      phone: maskPhone(phone),
      matches: customers.length
    });
    return customers;
  }

  async getOrder(
    tenantId: string,
    userId: string,
    orderNumber: string
  ): Promise<TermwaiOrderDetail> {
    const order = await this.client.getOrder(await this.apiKey(tenantId), orderNumber);
    await this.auditLookup(tenantId, userId, { orderNumber });
    return order;
  }

  private findCredential(tenantId: string) {
    return this.prisma.integrationCredential.findFirst({
      where: { tenantId, provider: IntegrationProvider.TERMWAI, deletedAt: null }
    });
  }

  private async apiKey(tenantId: string): Promise<string> {
    const credential = await this.findCredential(tenantId);
    if (!credential) {
      throw new HttpException(
        {
          success: false,
          error: { code: "TERMWAI_NOT_CONNECTED", message: "Termwai is not connected." }
        },
        HttpStatus.CONFLICT
      );
    }
    return this.cryptoSecret.decrypt(credential.encryptedApiKey);
  }

  private async auditLookup(
    tenantId: string,
    userId: string,
    detail: Record<string, string | number>
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: AuditAction.INTEGRATION_LOOKUP,
        targetType: "IntegrationCredential",
        metadata: { provider: IntegrationProvider.TERMWAI, ...detail }
      }
    });
  }
}
