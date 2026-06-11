import { Injectable, NotFoundException } from "@nestjs/common";
import { Tenant, TenantSettings } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { UpdateTenantSettingsDto } from "./dto/update-tenant-settings.dto";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenant(tenantId: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id: tenantId,
        deletedAt: null
      }
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    return tenant;
  }

  async updateTenant(tenantId: string, dto: UpdateTenantDto): Promise<Tenant> {
    await this.getTenant(tenantId);
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: dto
    });
  }

  async getSettings(tenantId: string): Promise<TenantSettings> {
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId }
    });

    if (!settings) {
      throw new NotFoundException("Tenant settings not found");
    }

    return settings;
  }

  async updateSettings(
    tenantId: string,
    dto: UpdateTenantSettingsDto
  ): Promise<TenantSettings> {
    await this.getTenant(tenantId);
    return this.prisma.tenantSettings.update({
      where: { tenantId },
      data: dto
    });
  }
}
