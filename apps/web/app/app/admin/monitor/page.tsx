"use client";

import { ShieldAlert } from "lucide-react";
import AdminMonitor from "../../../../components/monitor/admin-monitor";
import { useSuperOwnerGate } from "../../../lib/use-super-owner-gate";

export default function AdminMonitorPage() {
  const { isLoading, isReady, isDenied } = useSuperOwnerGate({
    deniedRedirect: "/app/inbox"
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500 font-medium">Verifying access rights...</p>
      </div>
    );
  }

  if (isDenied || !isReady) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 gap-3 text-center p-6">
        <ShieldAlert className="h-12 w-12 text-rose-500" />
        <h1 className="text-xl font-bold text-slate-900">Access Denied</h1>
        <p className="text-sm text-slate-500 max-w-sm">This telemetry dashboard is restricted to platform SuperOwners only.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-slate-50 px-8 py-8">
      <AdminMonitor />
    </div>
  );
}
