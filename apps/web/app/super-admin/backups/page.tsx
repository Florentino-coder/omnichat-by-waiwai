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
  XCircle,
  MessageSquare
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
      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
        Success
      </Badge>
    );
  }
  if (status === "FAILED") {
    return (
      <Badge className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
        Failed
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
      Running
    </Badge>
  );
}

function healthTone(status: BackupHealth["status"]): string {
  if (status === "healthy") {
    return "text-emerald-600 font-bold";
  }
  if (status === "degraded") {
    return "text-amber-600 font-bold";
  }
  return "text-rose-600 font-bold";
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F7F7FA] to-[#EBEBFF] text-[#16182B]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-[#4636D7]" />
          <p className="text-sm font-medium text-slate-500">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F7F7FA] via-[#FCFCFD] to-[#EBEBFF] text-[#16182B] font-sans selection:bg-[#4636D7] selection:text-white relative overflow-x-hidden">
      
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-[#ECEBFF] opacity-70 blur-3xl" />
      <div className="absolute top-10 right-10 -z-10 h-96 w-96 rounded-full bg-blue-100/40 opacity-50 blur-3xl" />

      <header className="relative z-10 border-b border-white/50 bg-white/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4636D7] to-[#8B5CF6] text-white shadow-md shadow-indigo-200">
              <MessageSquare className="h-5.5 w-5.5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[#16182B] flex items-center gap-2">
                Backup Operations
              </h1>
              <p className="text-[10px] text-slate-500 font-medium leading-none mt-1">Database backups in R2 `chatwai-backups`</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/super-admin")}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 hover:text-[#4636D7] bg-white border border-[#DEDDE6] hover:border-[#4636D7]/20 rounded-xl transition-all shadow-sm"
            >
              <ArrowLeft size={14} />
              Console
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-100 hover:border-rose-600 rounded-xl transition-all shadow-sm"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white/80 border-[#DEDDE6]/50 shadow-md p-5 rounded-2xl backdrop-blur-md text-[#16182B]">
            <div className="flex items-center gap-3 mb-3">
              <Database className="h-5 w-5 text-sky-500" />
              <h2 className="font-bold text-sm text-slate-500 uppercase tracking-wider">Health</h2>
            </div>
            <p className={`text-2xl font-extrabold capitalize ${health ? healthTone(health.status) : "text-slate-400"}`}>
              {health?.status ?? "loading"}
            </p>
            <p className="text-xs text-slate-400 font-medium mt-2">
              Failures (7d): {health?.failuresLast7Days ?? 0}
            </p>
          </Card>

          <Card className="bg-white/80 border-[#DEDDE6]/50 shadow-md p-5 rounded-2xl md:col-span-2 backdrop-blur-md text-[#16182B]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <HardDrive className="h-5 w-5 text-indigo-500" />
                  <h2 className="font-bold text-sm text-slate-500 uppercase tracking-wider">Backup Bucket</h2>
                </div>
                <p className="font-mono text-sm text-slate-700 font-semibold">{health?.backupBucket ?? "chatwai-backups"}</p>
                <p className="text-xs text-slate-400 font-medium mt-2">
                  Latest success: {formatDateTime(health?.latestSuccessfulBackup?.completedAt ?? null)}
                </p>
              </div>
              <Button
                onClick={() => void handleTriggerBackup()}
                disabled={isTriggering}
                className="bg-[#4636D7] hover:bg-[#382BB5] text-white font-semibold rounded-xl flex items-center gap-2 shadow-md shadow-indigo-200"
              >
                <Play size={14} />
                {isTriggering ? "Running..." : "Run Manual Backup"}
              </Button>
            </div>
          </Card>
        </section>

        {error ? (
          <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-medium flex items-center gap-2">
            <CheckCircle2 size={14} />
            {successMessage}
          </div>
        ) : null}

        <Card className="bg-white/80 border-[#DEDDE6]/50 shadow-xl p-6 rounded-2xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-[#16182B]">Recent Backup Runs</h2>
              <p className="text-xs text-slate-500">Scheduled daily/weekly/monthly plus manual triggers</p>
            </div>
            <button
              onClick={() => void loadBackupOps()}
              className="p-2 text-slate-500 hover:text-[#4636D7] hover:bg-slate-100 rounded-xl transition-all border border-slate-200/60"
              title="Refresh"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-[#4636D7]" : ""}`} />
            </button>
          </div>

          {isLoading && runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-xs font-medium">
              <RefreshCw className="h-8 w-8 animate-spin text-[#4636D7]/50 mb-3" />
              Loading backup runs...
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-xs font-medium border border-dashed border-slate-200 rounded-xl">
              <XCircle className="h-10 w-10 text-slate-300 mb-3" />
              No backup runs recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#DEDDE6]/60 rounded-xl shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#DEDDE6]/60 text-slate-500 font-bold">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">R2 Key</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Started</th>
                    <th className="px-4 py-3">Completed</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {runs.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-50/50 transition-colors text-slate-700">
                      <td className="px-4 py-3 font-semibold text-[#16182B]">{run.runType}</td>
                      <td className="px-4 py-3">{statusBadge(run.status)}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{run.r2Key ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-600 font-semibold">{formatBytes(run.sizeBytes)}</td>
                      <td className="px-4 py-3 text-slate-400">{formatDateTime(run.startedAt)}</td>
                      <td className="px-4 py-3 text-slate-400">{formatDateTime(run.completedAt)}</td>
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
