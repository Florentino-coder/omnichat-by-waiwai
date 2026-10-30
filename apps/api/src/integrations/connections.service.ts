import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AuditAction, IntegrationConnection } from "@prisma/client";
import { randomBytes } from "crypto";
import { CryptoSecretService } from "../auth/crypto-secret.service";
import { PlanLimitExceededException } from "../common/exceptions/plan-limit-exceeded.exception";
import {
  assertResolvesToPublicAddress,
  assertSafePublicUrl
} from "../knowledge/knowledge-url.util";
import { PrismaService } from "../prisma/prisma.service";
import { ConnectClient, ConnectTarget } from "./connect.client";
import { ConnectCustomer, ConnectOrder } from "./connect-response.util";

const PREVIOUS_SECRET_TTL_MS = 24 * 60 * 60 * 1000;

export type ConnectionView = {
  id: string;
  name: string;
  baseUrl: string;
  keyId: string;
  lastTestedAt: Date | null;
  lastTestOk: boolean;
  previousSecretExpiresAt: Date | null;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  createdAt: Date;
};

export type ConnectionTestResult = {
  ok: boolean;
  signatureEnforced: boolean;
  errorCode: string | null;
};

const toView = (connection: IntegrationConnection): ConnectionView => ({
  id: connection.id,
  name: connection.name,
  baseUrl: connection.baseUrl,
  keyId: connection.keyId,
  lastTestedAt: connection.lastTestedAt,
  lastTestOk: connection.lastTestOk,
  previousSecretExpiresAt: connection.previousSecretExpiresAt,
  suspendedAt: connection.suspendedAt,
  suspendedReason: connection.suspendedReason,
  createdAt: connection.createdAt
});

const maskPhone = (phone: string): string => `***${phone.replace(/\D/g, "").slice(-4)}`;
const generateSecret = (): string => `cs_${randomBytes(32).toString("base64url")}`;

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoSecret: CryptoSecretService,
    private readonly client: ConnectClient
  ) {}

  async getStatus(tenantId: string): Promise<{ connected: boolean }> {
    const connection = await this.findActive(tenantId);
    return { connected: Boolean(connection?.lastTestOk && !connection.suspendedAt) };
  }

  async getConnection(tenantId: string): Promise<ConnectionView | null> {
    const connection = await this.findActive(tenantId);
    return connection ? toView(connection) : null;
  }

  async create(
    tenantId: string,
    userId: string,
    name: string,
    rawBaseUrl: string
  ): Promise<ConnectionView & { secret: string }> {
    const baseUrl = await this.validateBaseUrl(rawBaseUrl);
    await this.assertNotSuspended(tenantId);
    await this.assertWithinPlanLimit(tenantId, userId);

    const secret = generateSecret();
    const connection = await this.prisma.integrationConnection.create({
      data: {
        tenantId,
        name: name.trim(),
        baseUrl,
        keyId: `ck_${randomBytes(12).toString("hex")}`,
        encryptedSecret: this.cryptoSecret.encrypt(secret)
      }
    });

    await this.audit(tenantId, userId, AuditAction.INTEGRATION_CONNECTED, connection.id, {
      name: connection.name,
      baseUrl,
      keyId: connection.keyId
    });

    return { ...toView(connection), secret };
  }

  async test(tenantId: string, userId: string): Promise<ConnectionTestResult> {
    const connection = await this.requireConnection(tenantId);
    this.assertConnectionActive(connection);
    const target = this.toTarget(connection);

    const result: ConnectionTestResult = { ok: false, signatureEnforced: false, errorCode: null };
    try {
      await this.client.health(target);
      result.signatureEnforced = await this.client.rejectsBadSignature(target);
      // A system that accepts unsigned requests exposes customer data to anyone.
      result.ok = result.signatureEnforced;
      result.errorCode = result.ok ? null : "CONNECT_SIGNATURE_NOT_ENFORCED";
    } catch (error) {
      result.errorCode = this.errorCode(error);
    }

    await this.prisma.integrationConnection.updateMany({
      where: { id: connection.id, tenantId },
      data: { lastTestedAt: new Date(), lastTestOk: result.ok }
    });
    await this.audit(tenantId, userId, AuditAction.INTEGRATION_TESTED, connection.id, {
      ok: result.ok,
      errorCode: result.errorCode
    });

    return result;
  }

  async rotateSecret(
    tenantId: string,
    userId: string
  ): Promise<ConnectionView & { secret: string }> {
    const connection = await this.requireConnection(tenantId);
    const secret = generateSecret();
    const previousSecretExpiresAt = new Date(Date.now() + PREVIOUS_SECRET_TTL_MS);

    await this.prisma.integrationConnection.updateMany({
      where: { id: connection.id, tenantId },
      data: {
        encryptedSecret: this.cryptoSecret.encrypt(secret),
        encryptedPreviousSecret: connection.encryptedSecret,
        previousSecretExpiresAt
      }
    });
    await this.audit(tenantId, userId, AuditAction.INTEGRATION_SECRET_ROTATED, connection.id, {
      keyId: connection.keyId
    });

    return { ...toView({ ...connection, previousSecretExpiresAt }), secret };
  }

  async disconnect(tenantId: string, userId: string): Promise<void> {
    const connection = await this.requireConnection(tenantId);
    await this.prisma.integrationConnection.updateMany({
      where: { id: connection.id, tenantId },
      data: { deletedAt: new Date() }
    });
    await this.audit(tenantId, userId, AuditAction.INTEGRATION_DISCONNECTED, connection.id, {
      keyId: connection.keyId
    });
  }

  async lookupCustomers(
    tenantId: string,
    userId: string,
    phone: string
  ): Promise<ConnectCustomer[]> {
    const connection = await this.requireVerifiedConnection(tenantId);
    const customers = await this.client.lookupCustomers(this.toTarget(connection), phone);
    await this.audit(tenantId, userId, AuditAction.INTEGRATION_LOOKUP, connection.id, {
      phone: maskPhone(phone),
      matches: customers.length
    });
    return customers;
  }

  async getOrder(
    tenantId: string,
    userId: string,
    orderNumber: string
  ): Promise<{ order: ConnectOrder; customer: ConnectCustomer | null }> {
    const connection = await this.requireVerifiedConnection(tenantId);
    const detail = await this.client.getOrder(this.toTarget(connection), orderNumber);
    await this.audit(tenantId, userId, AuditAction.INTEGRATION_LOOKUP, connection.id, {
      orderNumber
    });
    return detail;
  }

  private findActive(tenantId: string): Promise<IntegrationConnection | null> {
    return this.prisma.integrationConnection.findFirst({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
  }

  private async requireConnection(tenantId: string): Promise<IntegrationConnection> {
    const connection = await this.findActive(tenantId);
    if (!connection) {
      throw new NotFoundException("No connection found");
    }
    return connection;
  }

  private async requireVerifiedConnection(tenantId: string): Promise<IntegrationConnection> {
    const connection = await this.findActive(tenantId);
    if (connection) {
      this.assertConnectionActive(connection);
    }
    if (!connection?.lastTestOk) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: "CONNECT_NOT_VERIFIED",
            message: "Connect and test a system before looking up data."
          }
        },
        HttpStatus.CONFLICT
      );
    }
    return connection;
  }

  private assertConnectionActive(connection: IntegrationConnection): void {
    if (connection.suspendedAt) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: "CONNECT_SUSPENDED",
            message: "This connection was suspended by the platform administrator."
          }
        },
        HttpStatus.FORBIDDEN
      );
    }
  }

  /** Includes disconnected rows, so deleting and recreating cannot lift a suspension. */
  private async assertNotSuspended(tenantId: string): Promise<void> {
    const suspended = await this.prisma.integrationConnection.count({
      where: { tenantId, suspendedAt: { not: null } }
    });
    if (suspended > 0) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: "CONNECT_SUSPENDED",
            message: "Connections for this account were suspended by the platform administrator."
          }
        },
        HttpStatus.FORBIDDEN
      );
    }
  }

  private toTarget(connection: IntegrationConnection): ConnectTarget {
    const secrets = [this.cryptoSecret.decrypt(connection.encryptedSecret)];
    if (
      connection.encryptedPreviousSecret &&
      connection.previousSecretExpiresAt &&
      connection.previousSecretExpiresAt > new Date()
    ) {
      secrets.push(this.cryptoSecret.decrypt(connection.encryptedPreviousSecret));
    }
    return { baseUrl: connection.baseUrl, keyId: connection.keyId, secrets };
  }

  private async validateBaseUrl(rawBaseUrl: string): Promise<string> {
    const url = assertSafePublicUrl(rawBaseUrl);
    if (url.username || url.password || url.search || url.hash) {
      throw new BadRequestException("URL must not include credentials, a query, or a fragment");
    }
    await assertResolvesToPublicAddress(url);
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  }

  private async assertWithinPlanLimit(tenantId: string, userId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { planId: true }
    });
    const limits = tenant
      ? await this.prisma.planLimit.findUnique({ where: { planId: tenant.planId } })
      : null;
    if (!tenant || !limits) {
      throw new NotFoundException("Plan limit not found");
    }

    const current = await this.prisma.integrationConnection.count({
      where: { tenantId, deletedAt: null }
    });
    if (limits.maxIntegrations === 1 && current === 1) {
      throw new ConflictException("Disconnect the current system before adding another");
    }
    if (current >= limits.maxIntegrations) {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: AuditAction.PLAN_LIMIT_EXCEEDED,
          targetType: "IntegrationConnection",
          metadata: {
            planId: tenant.planId,
            limit: limits.maxIntegrations,
            current
          }
        }
      });
      throw new PlanLimitExceededException("Integration limit reached for the current plan.", {
        planId: tenant.planId,
        limit: limits.maxIntegrations,
        current
      });
    }
  }

  private errorCode(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse() as { error?: { code?: string } };
      return response.error?.code ?? "CONNECT_UNAVAILABLE";
    }
    return "CONNECT_UNAVAILABLE";
  }

  private async audit(
    tenantId: string,
    userId: string,
    action: AuditAction,
    targetId: string,
    metadata: Record<string, string | number | boolean | null>
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { tenantId, userId, action, targetType: "IntegrationConnection", targetId, metadata }
    });
  }
}
