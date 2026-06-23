"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Brain,
  Clock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Zap
} from "lucide-react";
import { Badge, Button, Card } from "@omnichat/ui";
import { apiFetch } from "../../lib/api-client";
import { clearAuthSessionCookies } from "../../lib/session-cookies";
import { verifySuperOwnerAccess } from "../../lib/super-owner-access";

type AiPlatformStats = {
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
  errorDistribution: Array<{ code: string; count: number }>;
  topTenants: Array<{
    tenantId: string;
    tenantName: string;
    used: number;
    limit: number;
    calls24h: number;
  }>;
};

type AiProviderHealth = {
  id: string;
  label: string;
  configured: boolean;
  modelName: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastLatencyMs: number | null;
  lastErrorCode: string | null;
};

type AiSlowCall = {
  id: string;
  tenantId: string;
  tenantName: string;
  conversationId: string;
  provider: string;
  latencyMs: number;
  actionType: string;
  createdAt: string;
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("th-TH");
}

function latencyTone(ms: number): string {
  if (ms >= 8000) {
    return "text-rose-400";
  }
  if (ms >= 3000) {
    return "text-amber-400";
  }
  return "text-emerald-400";
}

export default function SuperAdminAiMonitorPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState<AiPlatformStats | null>(null);
  const [health, setHealth] = useState<AiProviderHealth[]>([]);
  const [slowest, setSlowest] = useState<AiSlowCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function verifyAccess(): Promise<void> {
      const userStr = window.localStorage.getItem("omnichat.user");
      if (!userStr) {
        router.push("/login");
        return;
      }

      try {
        const user = JSON.parse(userStr) as { isSuperOwner?: boolean };
        if (!user.isSuperOwner) {
          router.push("/login");
          return;
        }
      } catch {
        router.push("/login");
        return;
      }

      const allowed = await verifySuperOwnerAccess();
      if (!active) {
        return;
      }
      if (!allowed) {
        router.push("/login");
        return;
      }
      setIsAuthenticated(true);
    }

    void verifyAccess();

    return () => {
      active = false;
    };
  }, [router]);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) {
      setIsLoading(true);
    }
    setIsRefreshing(true);
    setError(null);
    try {
      const [statsRes, healthRes, slowestRes] = await Promise.all([
        apiFetch<AiPlatformStats>("/api/v1/super-admin/ai/stats"),
        apiFetch<{ providers: AiProviderHealth[] }>("/api/v1/super-admin/ai/health"),
        apiFetch<AiSlowCall[]>("/api/v1/super-admin/ai/slowest?limit=10")
      ]);
      setStats(statsRes);
      setHealth(healthRes.providers ?? []);
      setSlowest(Array.isArray(slowestRes) ? slowestRes : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AI monitor data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void loadData();
      const intervalId = window.setInterval(() => {
        void loadData(true);
      }, 30000);
      return () => window.clearInterval(intervalId);
    }
  }, [isAuthenticated, loadData]);

  const handleLogout = () => {
    window.localStorage.removeItem("omnichat.accessToken");
    window.localStorage.removeItem("omnichat.refreshToken");
    window.localStorage.removeItem("omnichat.user");
    clearAuthSessionCookies();
    router.push("/login");
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-violet-500/30 bg-violet-600/20 p-2">
              <Brain className="h-6 w-6 text-violet-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AI Platform Monitor</h1>
              <p className="text-xs text-slate-400">Latency, errors, credits across all tenants</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
              onClick={() => router.push("/super-admin")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Console
            </Button>
            <Button
              variant="secondary"
              className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
              onClick={() => void loadData()}
              disabled={isRefreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="secondary"
              className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {error && (
          <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {isLoading && !stats ? (
          <div className="flex min-h-[320px] items-center justify-center text-slate-400">
            <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
            Loading AI telemetry...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl border-slate-800 bg-slate-900/80 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-slate-400">Calls (24h)</span>
                  <Activity className="h-4 w-4 text-indigo-400" />
                </div>
                <p className="text-3xl font-bold">{stats?.totalCalls24h ?? 0}</p>
                <p className="mt-1 text-xs text-slate-500">
                  success {stats?.successCount24h ?? 0} / fail {stats?.failureCount24h ?? 0}
                </p>
              </Card>

              <Card className="rounded-2xl border-slate-800 bg-slate-900/80 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-slate-400">Success Rate</span>
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-3xl font-bold">
                  {(((stats?.successRate ?? 0) * 100).toFixed(1))}%
                </p>
              </Card>

              <Card className="rounded-2xl border-slate-800 bg-slate-900/80 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-slate-400">Avg Latency</span>
                  <Clock className="h-4 w-4 text-sky-400" />
                </div>
                <p className={`text-3xl font-bold ${latencyTone(stats?.avgLatencyMs ?? 0)}`}>
                  {stats?.avgLatencyMs ?? 0}ms
                </p>
              </Card>

              <Card className="rounded-2xl border-slate-800 bg-slate-900/80 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-slate-400">Credits (month)</span>
                  <Zap className="h-4 w-4 text-amber-400" />
                </div>
                <p className="text-3xl font-bold">{stats?.creditsConsumedMonth ?? 0}</p>
                <p className="mt-1 text-xs text-slate-500">P95 {stats?.p95LatencyMs ?? 0}ms</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card className="rounded-2xl border-slate-800 bg-slate-900/80 p-6">
                <h2 className="mb-4 text-lg font-semibold">Provider Health</h2>
                <div className="space-y-3">
                  {health.map((provider) => (
                    <div
                      key={provider.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{provider.label}</p>
                          <p className="text-xs text-slate-500">{provider.modelName}</p>
                        </div>
                        <Badge
                          className={
                            provider.configured
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                          }
                        >
                          {provider.configured ? "Key OK" : "No Key"}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                        <p>Last success: {formatDateTime(provider.lastSuccessAt)}</p>
                        <p>Last latency: {provider.lastLatencyMs ?? "-"} ms</p>
                        <p>Last error: {formatDateTime(provider.lastErrorAt)}</p>
                        <p>Last error code: {provider.lastErrorCode ?? "-"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="rounded-2xl border-slate-800 bg-slate-900/80 p-6">
                <h2 className="mb-4 text-lg font-semibold">Errors (24h)</h2>
                {stats?.errorDistribution.length ? (
                  <div className="space-y-2">
                    {stats.errorDistribution.map((item) => (
                      <div
                        key={item.code}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm"
                      >
                        <span className="text-slate-300">{item.code}</span>
                        <span className="font-semibold text-rose-300">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No AI failures in the last 24 hours.</p>
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card className="rounded-2xl border-slate-800 bg-slate-900/80 p-6">
                <h2 className="mb-4 text-lg font-semibold">Top Tenants by Credits</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2">Tenant</th>
                        <th className="py-2">Used</th>
                        <th className="py-2">Limit</th>
                        <th className="py-2">Calls 24h</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(stats?.topTenants ?? []).map((tenant) => (
                        <tr key={tenant.tenantId} className="border-b border-slate-850">
                          <td className="py-2 font-medium">{tenant.tenantName}</td>
                          <td className="py-2">{tenant.used}</td>
                          <td className="py-2">{tenant.limit || "∞"}</td>
                          <td className="py-2">{tenant.calls24h}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="rounded-2xl border-slate-800 bg-slate-900/80 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  <h2 className="text-lg font-semibold">Slowest AI Calls</h2>
                </div>
                <div className="space-y-2">
                  {slowest.length === 0 ? (
                    <p className="text-sm text-slate-500">No latency data yet.</p>
                  ) : (
                    slowest.map((call) => (
                      <div
                        key={call.id}
                        className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{call.tenantName}</span>
                          <span className={latencyTone(call.latencyMs)}>{call.latencyMs}ms</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {call.provider} · {call.actionType} · {formatDateTime(call.createdAt)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
