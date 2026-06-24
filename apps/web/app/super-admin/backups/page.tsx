"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  HardDrive,
  LogOut,
  Play,
  RefreshCw,
  ShieldCheck,
  XCircle
} from "lucide-react";
import { Badge, Button, Card } from "@omnichat/ui";
import { apiFetch } from "../../lib/api-client";
import { clearAuthSessionCookies } from "../../lib/session-cookies";
import { useSuperOwnerGate } from "../../lib/use-super-owner-gate";

type BackupRun = {
  id: string;
  runType: string;
  status: string;
  r2Key: string | null;
  bucket: string;
  sizeBytes: string | null;
  errorMessage: string | null;
  triggeredByUserId: string | null;
  startedAt: string;
  completedAt: string | null;
};

type BackupHealth = {
  status: "healthy" | "degraded" | "unhealthy";
  latestSuccessfulBackup: BackupRun | null;
  latestFailedBackup: BackupRun | null;
  failuresLast7Days: number;
  backupBucket: string;
};

function formatBytes(value: string | null): string {
  if (!value) {
    return "-";
  }
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "-";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("th-TH");
}

function statusBadge(status: string) {
  if (status === "SUCCESS") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        Success
      </Badge>
    );
  }
  if (status === "FAILED") {
    return (
      <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20">
        Failed
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/10 text-amber-300 border border-amber-500/20">
      Running
    </Badge>
  );
}

function healthTone(status: BackupHealth["status"]): string {
  if (status === "healthy") {
    return "text-emerald-400";
  }
  if (status === "degraded") {
    return "text-amber-400";
  }
  return "text-rose-400";
}

export default function SuperAdminBackupsPage() {
  const router = useRouter();
  const { isLoading: isAuthGateLoading, isReady: isAuthenticated } = useSuperOwnerGate();
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [health, setHealth] = useState<BackupHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadBackupOps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [healthData, runsData] = await Promise.all([
        apiFetch<BackupHealth>("/api/v1/super-admin/backups/health"),
        apiFetch<BackupRun[]>("/api/v1/super-admin/backups/runs?limit=30")
      ]);
      setHealth(healthData);
      setRuns(Array.isArray(runsData) ? runsData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load backup operations.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void loadBackupOps();
    }
  }, [isAuthenticated, loadBackupOps]);

  const handleLogout = () => {
    window.localStorage.removeItem("omnichat.accessToken");
    window.localStorage.removeItem("omnichat.refreshToken");
    window.localStorage.removeItem("omnichat.user");
    clearAuthSessionCookies();
    router.push("/login");
  };

  const handleTriggerBackup = async () => {
    setIsTriggering(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await apiFetch("/api/v1/super-admin/backups/run", { method: "POST" });
      setSuccessMessage("Manual backup started successfully.");
      await loadBackupOps();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger manual backup.");
    } finally {
      setIsTriggering(false);
    }
  };

  if (isAuthGateLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-sm font-medium text-slate-400">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500 selection:text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-sky-500/10 rounded-full blur-[120px]" />
      </div>

      <header className="relative z-10 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/30">
              <ShieldCheck className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white font-sans">
                Backup Operations
              </h1>
              <p className="text-xs text-slate-400 font-medium">Database backups in R2 `chatwai-backups`</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/super-admin")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
            >
              <ArrowLeft size={16} />
              Console
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-red-950/40 hover:border-red-900/40 border border-slate-700 rounded-xl transition-all"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900/80 border-slate-800 p-5 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <Database className="h-5 w-5 text-sky-400" />
              <h2 className="font-semibold">Health</h2>
            </div>
            <p className={`text-2xl font-bold capitalize ${health ? healthTone(health.status) : "text-slate-400"}`}>
              {health?.status ?? "loading"}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Failures (7d): {health?.failuresLast7Days ?? 0}
            </p>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800 p-5 rounded-2xl md:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <HardDrive className="h-5 w-5 text-indigo-400" />
                  <h2 className="font-semibold">Backup Bucket</h2>
                </div>
                <p className="font-mono text-sm text-slate-300">{health?.backupBucket ?? "chatwai-backups"}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Latest success: {formatDateTime(health?.latestSuccessfulBackup?.completedAt ?? null)}
                </p>
              </div>
              <Button
                onClick={() => void handleTriggerBackup()}
                disabled={isTriggering}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl flex items-center gap-2"
              >
                <Play size={16} />
                {isTriggering ? "Running..." : "Run Manual Backup"}
              </Button>
            </div>
          </Card>
        </section>

        {error ? (
          <div className="p-3 text-sm bg-red-950/40 border border-red-900/50 text-red-400 rounded-xl flex items-center gap-2">
            <AlertTriangle size={16} />
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="p-3 text-sm bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 rounded-xl flex items-center gap-2">
            <CheckCircle2 size={16} />
            {successMessage}
          </div>
        ) : null}

        <Card className="bg-slate-900/80 border-slate-800 shadow-2xl p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Recent Backup Runs</h2>
              <p className="text-xs text-slate-400">Scheduled daily/weekly/monthly plus manual triggers</p>
            </div>
            <button
              onClick={() => void loadBackupOps()}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-850"
              title="Refresh"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-indigo-400" : ""}`} />
            </button>
          </div>

          {isLoading && runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-sm">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-500/50 mb-3" />
              Loading backup runs...
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
              <XCircle className="h-10 w-10 text-slate-700 mb-3" />
              No backup runs recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800/80 rounded-xl">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold text-xs">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">R2 Key</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Started</th>
                    <th className="px-4 py-3">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 bg-slate-900/40">
                  {runs.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{run.runType}</td>
                      <td className="px-4 py-3">{statusBadge(run.status)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{run.r2Key ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-300">{formatBytes(run.sizeBytes)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(run.startedAt)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(run.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
