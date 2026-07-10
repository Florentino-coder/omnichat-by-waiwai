"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Clock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Zap,
  MessageSquare
} from "lucide-react";
import { Badge, Button, Card } from "@omnichat/ui";
import { apiFetch } from "../../lib/api-client";
import { clearAuthSessionCookies } from "../../lib/session-cookies";
import { useSuperOwnerGate } from "../../lib/use-super-owner-gate";

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
    return "text-rose-600 font-bold";
  }
  if (ms >= 3000) {
    return "text-amber-600 font-bold";
  }
  return "text-emerald-600 font-bold";
}

export default function SuperAdminAiMonitorPage() {
  const router = useRouter();
  const { isLoading: isAuthGateLoading, isReady: isAuthenticated } = useSuperOwnerGate();
  const [stats, setStats] = useState<AiPlatformStats | null>(null);
  const [health, setHealth] = useState<AiProviderHealth[]>([]);
  const [slowest, setSlowest] = useState<AiSlowCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (isAuthGateLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F7F7FA] to-[#EBEBFF] text-[#16182B]">
        <RefreshCw className="h-8 w-8 animate-spin text-[#4636D7]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F7F7FA] via-[#FCFCFD] to-[#EBEBFF] text-[#16182B] font-sans selection:bg-[#4636D7] selection:text-white relative overflow-x-hidden">
      
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-[#ECEBFF] opacity-70 blur-3xl" />
      <div className="absolute top-10 right-10 -z-10 h-96 w-96 rounded-full bg-blue-100/40 opacity-50 blur-3xl" />

      <header className="relative z-10 border-b border-white/50 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4636D7] to-[#8B5CF6] text-white shadow-md shadow-indigo-200">
              <MessageSquare className="h-5.5 w-5.5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[#16182B] flex items-center gap-2">
                ChatWai 
                <span className="text-violet-600 font-semibold text-xs bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">AI Monitor</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-medium leading-none mt-1">Latency, errors, credits across all tenants</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold"
              onClick={() => router.push("/super-admin")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Console
            </Button>
            <Button
              variant="secondary"
              className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold"
              onClick={() => void loadData()}
              disabled={isRefreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="secondary"
              className="border-rose-200 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white font-bold transition-all"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl space-y-6 px-6 py-8">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium">
            {error}
          </div>
        )}

        {isLoading && !stats ? (
          <div className="flex min-h-[320px] items-center justify-center text-slate-400 text-sm font-medium">
            <RefreshCw className="mr-2 h-5 w-5 animate-spin text-[#4636D7]" />
            Loading AI telemetry...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl border-[#DEDDE6]/50 bg-white/80 shadow-md p-5 text-[#16182B] backdrop-blur-md">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Calls (24h)</span>
                  <Activity className="h-4 w-4 text-indigo-500" />
                </div>
                <p className="text-3xl font-extrabold">{stats?.totalCalls24h ?? 0}</p>
                <p className="mt-1 text-xs text-slate-400 font-medium">
                  success {stats?.successCount24h ?? 0} / fail {stats?.failureCount24h ?? 0}
                </p>
              </Card>

              <Card className="rounded-2xl border-[#DEDDE6]/50 bg-white/80 shadow-md p-5 text-[#16182B] backdrop-blur-md">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Success Rate</span>
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-3xl font-extrabold text-emerald-600">
                  {(((stats?.successRate ?? 0) * 100).toFixed(1))}%
                </p>
              </Card>

              <Card className="rounded-2xl border-[#DEDDE6]/50 bg-white/80 shadow-md p-5 text-[#16182B] backdrop-blur-md">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Latency</span>
                  <Clock className="h-4 w-4 text-sky-500" />
                </div>
                <p className={`text-3xl font-extrabold ${latencyTone(stats?.avgLatencyMs ?? 0)}`}>
                  {stats?.avgLatencyMs ?? 0}ms
                </p>
              </Card>

              <Card className="rounded-2xl border-[#DEDDE6]/50 bg-white/80 shadow-md p-5 text-[#16182B] backdrop-blur-md">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Credits (month)</span>
                  <Zap className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-3xl font-extrabold text-amber-600">{stats?.creditsConsumedMonth ?? 0}</p>
                <p className="mt-1 text-xs text-slate-400 font-medium">P95 {stats?.p95LatencyMs ?? 0}ms</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card className="rounded-2xl border-[#DEDDE6]/50 bg-white/80 shadow-xl p-6 text-[#16182B] backdrop-blur-md">
                <h2 className="mb-4 text-base font-bold text-[#16182B]">Provider Health</h2>
                <div className="space-y-3">
                  {health.map((provider) => (
                    <div
                      key={provider.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-[#16182B]">{provider.label}</p>
                          <p className="text-xs text-slate-400 font-medium">{provider.modelName}</p>
                        </div>
                        <Badge
                          className={
                            provider.configured
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800 text-[10px] font-bold"
                              : "border-rose-200 bg-rose-50 text-rose-800 text-[10px] font-bold"
                          }
                        >
                          {provider.configured ? "Key OK" : "No Key"}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-500">
                        <p>Last success: {formatDateTime(provider.lastSuccessAt)}</p>
                        <p>Last latency: {provider.lastLatencyMs ?? "-"} ms</p>
                        <p>Last error: {formatDateTime(provider.lastErrorAt)}</p>
                        <p>Last error code: {provider.lastErrorCode ?? "-"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="rounded-2xl border-[#DEDDE6]/50 bg-white/80 shadow-xl p-6 text-[#16182B] backdrop-blur-md">
                <h2 className="mb-4 text-base font-bold text-[#16182B]">Errors (24h)</h2>
                {stats?.errorDistribution.length ? (
                  <div className="space-y-2">
                    {stats.errorDistribution.map((item) => (
                      <div
                        key={item.code}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs"
                      >
                        <span className="text-slate-600 font-bold">{item.code}</span>
                        <span className="font-extrabold text-rose-600">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 font-medium">No AI failures in the last 24 hours.</p>
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card className="rounded-2xl border-[#DEDDE6]/50 bg-white/80 shadow-xl p-6 text-[#16182B] backdrop-blur-md">
                <h2 className="mb-4 text-base font-bold text-[#16182B]">Top Tenants by Credits</h2>
                <div className="overflow-x-auto border border-[#DEDDE6]/60 rounded-xl shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-[#DEDDE6]/60 text-slate-500 font-bold">
                        <th className="px-4 py-3">Tenant</th>
                        <th className="px-4 py-3">Used</th>
                        <th className="px-4 py-3">Limit</th>
                        <th className="px-4 py-3">Calls 24h</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {(stats?.topTenants ?? []).map((tenant) => (
                        <tr key={tenant.tenantId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-[#16182B]">{tenant.tenantName}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{tenant.used}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{tenant.limit || "∞"}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{tenant.calls24h}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="rounded-2xl border-[#DEDDE6]/50 bg-white/80 shadow-xl p-6 text-[#16182B] backdrop-blur-md">
                <div className="mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <h2 className="text-base font-bold text-[#16182B]">Slowest AI Calls</h2>
                </div>
                <div className="space-y-2">
                  {slowest.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium">No latency data yet.</p>
                  ) : (
                    slowest.map((call) => (
                      <div
                        key={call.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#16182B]">{call.tenantName}</span>
                          <span className={latencyTone(call.latencyMs)}>{call.latencyMs}ms</span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400 font-semibold leading-none mt-2">
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
