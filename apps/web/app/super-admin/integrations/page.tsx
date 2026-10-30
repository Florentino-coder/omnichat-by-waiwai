"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button, Card } from "@omnichat/ui";
import { apiFetch } from "../../lib/api-client";
import { useSuperOwnerGate } from "../../lib/use-super-owner-gate";

type IntegrationRow = {
  id: string;
  tenantName: string;
  planId: string;
  name: string;
  baseUrl: string;
  keyId: string;
  lastTestedAt: string | null;
  lastTestOk: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  deletedAt: string | null;
  lookupsThisMonth: number;
};

const API_PATH = "/api/v1/super-admin/integrations";

function statusOf(row: IntegrationRow): { label: string; className: string } {
  if (row.suspendedAt) {
    return { label: "Suspended", className: "bg-red-50 text-red-700" };
  }
  if (row.lastTestOk) {
    return { label: "Active", className: "bg-emerald-50 text-emerald-700" };
  }
  return { label: "Not verified", className: "bg-amber-50 text-amber-700" };
}

export default function SuperAdminIntegrationsPage() {
  const router = useRouter();
  const { isLoading: isGateLoading, isReady } = useSuperOwnerGate();
  const [rows, setRows] = useState<IntegrationRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await apiFetch<IntegrationRow[]>(API_PATH));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load connections.");
    }
  }, []);

  useEffect(() => {
    if (isReady) {
      void load();
    }
  }, [isReady, load]);

  async function changeState(row: IntegrationRow, action: "suspend" | "resume"): Promise<void> {
    let body: string | undefined;
    if (action === "suspend") {
      const reason = window.prompt(`Why suspend "${row.name}" (${row.tenantName})? Agents lose lookups right away.`);
      if (!reason?.trim()) {
        return;
      }
      body = JSON.stringify({ reason: reason.trim() });
    } else if (!window.confirm(`Resume "${row.name}" (${row.tenantName})?`)) {
      return;
    }

    setBusyId(row.id);
    setError(null);
    try {
      await apiFetch(`${API_PATH}/${row.id}/${action}`, { method: "POST", body });
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update the connection.");
    } finally {
      setBusyId(null);
    }
  }

  if (isGateLoading || !isReady) {
    return null;
  }

  return (
    <div className="h-screen overflow-y-auto bg-[#F7F7FA]">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Back to platform console"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
              onClick={() => router.push("/super-admin")}
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#16182B]">Integrations</h1>
              <p className="text-xs text-slate-500">ChatWai Connect connections across all tenants</p>
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            <RefreshCw size={14} className="mr-2" />
            Refresh
          </Button>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <Card className="overflow-x-auto bg-white p-0">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold">System</th>
                <th className="px-4 py-3 font-semibold">Key ID</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last test</th>
                <th className="px-4 py-3 text-right font-semibold">Lookups this month</th>
                <th className="px-4 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows?.map((row) => {
                const status = statusOf(row);
                return (
                  <tr key={row.id} className="border-b border-slate-100 align-top last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#16182B]">{row.tenantName}</p>
                      <p className="text-xs text-slate-500">{row.planId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#16182B]">{row.name}</p>
                      <p className="max-w-[260px] break-all font-mono text-xs text-slate-500">{row.baseUrl}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.keyId}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                      {row.deletedAt ? <p className="mt-1 text-xs text-slate-500">Disconnected by tenant</p> : null}
                      {row.suspendedReason ? (
                        <p className="mt-1 max-w-[220px] text-xs break-words text-slate-500">{row.suspendedReason}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {row.lastTestedAt ? new Date(row.lastTestedAt).toLocaleString() : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.lookupsThisMonth}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busyId === row.id}
                        onClick={() => void changeState(row, row.suspendedAt ? "resume" : "suspend")}
                      >
                        {row.suspendedAt ? "Resume" : "Suspend"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows?.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={7}>
                    No tenant has connected a system yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
