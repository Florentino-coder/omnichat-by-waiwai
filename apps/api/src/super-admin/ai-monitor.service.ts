import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AI_SUGGEST_USAGE_METRIC, getCurrentMonthUsagePeriod } from "../inbox/thai-speech.util";

export type AiProviderHealth = {
  id: string;
  label: string;
  configured: boolean;
  modelName: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastLatencyMs: number | null;
  lastErrorCode: string | null;
};

export type AiPlatformStats = {
  totalCalls24h: number;
  successCount24h: number;
  failureCount24h: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  creditsConsumedMonth: number;
  byProvider: Array<{
    provider: string;
    providerLabel: string;
    count: number;
    avgLatencyMs: number;
  }>;
  errorDistribution: Array<{
    code: string;
    count: number;
  }>;
  topTenants: Array<{
    tenantId: string;
    tenantName: string;
    used: number;
    limit: number;
    calls24h: number;
  }>;
};

export type AiSlowCall = {
  id: string;
  tenantId: string;
  tenantName: string;
  conversationId: string;
  provider: string;
  latencyMs: number;
  actionType: string;
  createdAt: string;
};

export type AiTenantUsage = {
  tenantId: string;
  tenantName: string;
  planId: string;
  used: number;
  limit: number;
  remaining: number;
  provider: string;
  calls24h: number;
  avgLatencyMs24h: number;
  recentCalls: Array<{
    id: string;
    conversationId: string;
    provider: string;
    latencyMs: number | null;
    status: string;
    createdAt: string;
  }>;
};

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  claude: "Anthropic Claude"
};

const PROVIDER_MODELS: Record<string, string> = {
  gemini: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  openai: process.env.OPENAI_MODEL || "gpt-4o-mini",
  claude: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest"
};

@Injectable()
export class AiMonitorService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<AiPlatformStats> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { periodStart } = getCurrentMonthUsagePeriod();

    const [
      suggestions24h,
      generatedAudits24h,
      failures24h,
      usageCounters,
      tenants,
      planLimits
    ] = await Promise.all([
      this.prisma.aiSuggestion.findMany({
        where: { createdAt: { gte: since24h } },
        select: {
          id: true,
          tenantId: true,
          provider: true,
          latencyMs: true
        }
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: AuditAction.AI_SUGGEST_GENERATED,
          createdAt: { gte: since24h }
        },
        select: {
          metadata: true
        }
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: AuditAction.AI_SUGGEST_FAILED,
          createdAt: { gte: since24h }
        },
        select: {
          metadata: true
        }
      }),
      this.prisma.usageCounter.findMany({
        where: {
          metric: AI_SUGGEST_USAGE_METRIC,
          periodStart
        },
        select: {
          tenantId: true,
          value: true
        }
      }),
      this.prisma.tenant.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, planId: true }
      }),
      this.prisma.planLimit.findMany({
        select: { planId: true, maxAiCreditsPerMonth: true }
      })
    ]);

    const testCalls24h = generatedAudits24h.filter((entry) => {
      const metadata = entry.metadata as { mode?: string } | null;
      return metadata?.mode === "test";
    }).length;

    const successCount24h = suggestions24h.length + testCalls24h;
    const failureCount24h = failures24h.length;
    const totalCalls24h = successCount24h + failureCount24h;
    const successRate =
      totalCalls24h > 0 ? Number((successCount24h / totalCalls24h).toFixed(4)) : 1;

    const latenciesFromSuggestions = suggestions24h
      .map((row) => row.latencyMs)
      .filter((value): value is number => typeof value === "number");

    const latenciesFromTests = generatedAudits24h
      .map((entry) => {
        const metadata = entry.metadata as { latencyMs?: number; mode?: string } | null;
        if (metadata?.mode !== "test") {
          return null;
        }
        return typeof metadata.latencyMs === "number" ? metadata.latencyMs : null;
      })
      .filter((value): value is number => typeof value === "number");

    const latencies = [...latenciesFromSuggestions, ...latenciesFromTests].sort((a, b) => a - b);
    const avgLatencyMs =
      latencies.length > 0
        ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
        : 0;
    const p95LatencyMs = this.percentile(latencies, 0.95);

    const providerMap = new Map<string, { count: number; totalLatency: number }>();
    for (const row of suggestions24h) {
      const provider = row.provider || "unknown";
      const bucket = providerMap.get(provider) ?? { count: 0, totalLatency: 0 };
      bucket.count += 1;
      if (typeof row.latencyMs === "number") {
        bucket.totalLatency += row.latencyMs;
      }
      providerMap.set(provider, bucket);
    }

    const byProvider = Array.from(providerMap.entries())
      .map(([provider, bucket]) => ({
        provider,
        providerLabel: this.getProviderLabel(provider),
        count: bucket.count,
        avgLatencyMs: bucket.count > 0 ? Math.round(bucket.totalLatency / bucket.count) : 0
      }))
      .sort((a, b) => b.count - a.count);

    const errorMap = new Map<string, number>();
    for (const failure of failures24h) {
      const metadata = failure.metadata as { errorCode?: string } | null;
      const code = metadata?.errorCode || "AI_GENERATION_FAILED";
      errorMap.set(code, (errorMap.get(code) ?? 0) + 1);
    }
    const errorDistribution = Array.from(errorMap.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);

    const tenantNameById = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
    const planLimitById = new Map(
      planLimits.map((limit) => [limit.planId, limit.maxAiCreditsPerMonth ?? 0])
    );
    const calls24hByTenant = new Map<string, number>();
    for (const row of suggestions24h) {
      calls24hByTenant.set(row.tenantId, (calls24hByTenant.get(row.tenantId) ?? 0) + 1);
    }

    const topTenants = usageCounters
      .map((counter) => {
        const tenant = tenants.find((item) => item.id === counter.tenantId);
        const limit = tenant ? (planLimitById.get(tenant.planId) ?? 0) : 0;
        return {
          tenantId: counter.tenantId,
          tenantName: tenantNameById.get(counter.tenantId) ?? counter.tenantId,
          used: Number(counter.value),
          limit,
          calls24h: calls24hByTenant.get(counter.tenantId) ?? 0
        };
      })
      .sort((a, b) => b.used - a.used)
      .slice(0, 10);

    const creditsConsumedMonth = usageCounters.reduce(
      (sum, counter) => sum + Number(counter.value),
      0
    );

    return {
      totalCalls24h,
      successCount24h,
      failureCount24h,
      successRate,
      avgLatencyMs,
      p95LatencyMs,
      creditsConsumedMonth,
      byProvider,
      errorDistribution,
      topTenants
    };
  }

  async getSlowest(limit = 20): Promise<AiSlowCall[]> {
    const rows = await this.prisma.aiSuggestion.findMany({
      where: {
        latencyMs: { not: null }
      },
      orderBy: { latencyMs: "desc" },
      take: limit,
      include: {
        tenant: {
          select: { name: true }
        }
      }
    });

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      tenantName: row.tenant.name,
      conversationId: row.conversationId,
      provider: row.provider || "unknown",
      latencyMs: row.latencyMs ?? 0,
      actionType: row.actionType,
      createdAt: row.createdAt.toISOString()
    }));
  }

  async getHealth(): Promise<{ providers: AiProviderHealth[] }> {
    const providerIds = ["gemini", "openai", "claude", "groq"] as const;

    const [latestSuccesses, latestFailures] = await Promise.all([
      this.prisma.aiSuggestion.findMany({
        where: { provider: { in: [...providerIds] } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          provider: true,
          createdAt: true,
          latencyMs: true
        }
      }),
      this.prisma.auditLog.findMany({
        where: { action: AuditAction.AI_SUGGEST_FAILED },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          createdAt: true,
          metadata: true
        }
      })
    ]);

    const providers = providerIds.map((id) => {
      const lastSuccess = latestSuccesses.find((row) => row.provider === id);
      const lastFailure = latestFailures.find((row) => {
        const metadata = row.metadata as { provider?: string } | null;
        return metadata?.provider === id;
      });

      return {
        id,
        label: this.getProviderLabel(id),
        configured: this.isProviderConfigured(id),
        modelName: PROVIDER_MODELS[id],
        lastSuccessAt: lastSuccess?.createdAt.toISOString() ?? null,
        lastErrorAt: lastFailure?.createdAt.toISOString() ?? null,
        lastLatencyMs: lastSuccess?.latencyMs ?? null,
        lastErrorCode:
          (lastFailure?.metadata as { errorCode?: string } | null)?.errorCode ?? null
      };
    });

    return { providers };
  }

  async getTenantUsage(tenantId: string): Promise<AiTenantUsage> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
      select: { id: true, name: true, planId: true }
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { periodStart } = getCurrentMonthUsagePeriod();

    const [settings, limits, counter, calls24h, recentCalls] = await Promise.all([
      this.prisma.tenantSettings.findUnique({
        where: { tenantId },
        select: { aiProvider: true }
      }),
      this.prisma.planLimit.findUnique({
        where: { planId: tenant.planId },
        select: { maxAiCreditsPerMonth: true }
      }),
      this.prisma.usageCounter.findUnique({
        where: {
          tenantId_metric_periodStart: {
            tenantId,
            metric: AI_SUGGEST_USAGE_METRIC,
            periodStart
          }
        }
      }),
      this.prisma.aiSuggestion.findMany({
        where: {
          tenantId,
          createdAt: { gte: since24h }
        },
        select: { latencyMs: true }
      }),
      this.prisma.aiSuggestion.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          conversationId: true,
          provider: true,
          latencyMs: true,
          status: true,
          createdAt: true
        }
      })
    ]);

    const used = Number(counter?.value ?? 0n);
    const limit = limits?.maxAiCreditsPerMonth ?? 0;
    const latencies24h = calls24h
      .map((row) => row.latencyMs)
      .filter((value): value is number => typeof value === "number");

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      planId: tenant.planId,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      provider: (settings?.aiProvider || process.env.LLM_PROVIDER || "gemini").toLowerCase(),
      calls24h: calls24h.length,
      avgLatencyMs24h:
        latencies24h.length > 0
          ? Math.round(latencies24h.reduce((sum, value) => sum + value, 0) / latencies24h.length)
          : 0,
      recentCalls: recentCalls.map((row) => ({
        id: row.id,
        conversationId: row.conversationId,
        provider: row.provider || "unknown",
        latencyMs: row.latencyMs,
        status: row.status,
        createdAt: row.createdAt.toISOString()
      }))
    };
  }

  private percentile(values: number[], ratio: number): number {
    if (values.length === 0) {
      return 0;
    }
    const index = Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1);
    return values[index] ?? 0;
  }

  private getProviderLabel(provider: string): string {
    return PROVIDER_LABELS[provider.toLowerCase()] ?? provider;
  }

  private isProviderConfigured(provider: string): boolean {
    switch (provider) {
      case "gemini":
        return Boolean(process.env.GEMINI_API_KEY);
      case "openai":
        return Boolean(process.env.OPENAI_API_KEY);
      case "claude":
        return Boolean(process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY);
      default:
        return false;
    }
  }
}
