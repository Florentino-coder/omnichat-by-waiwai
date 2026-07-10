"use client";

import { ShieldAlert, ArrowLeft, Activity } from "lucide-react";
import { useRouter } from "next/navigation";
import AdminMonitor from "../../../../components/monitor/admin-monitor";
import { useSuperOwnerGate } from "../../../lib/use-super-owner-gate";

export default function AdminMonitorPage() {
  const router = useRouter();
  const { isLoading, isReady, isDenied } = useSuperOwnerGate({
    deniedRedirect: "/app/inbox"
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-b from-[#F7F7FA] to-[#EBEBFF] text-[#16182B]">
        <p className="text-sm text-slate-500 font-medium">Verifying access rights...</p>
      </div>
    );
  }

  if (isDenied || !isReady) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gradient-to-b from-[#F7F7FA] to-[#EBEBFF] gap-3 text-center p-6">
        <ShieldAlert className="h-12 w-12 text-rose-500" />
        <h1 className="text-xl font-bold text-[#16182B]">Access Denied</h1>
        <p className="text-sm text-slate-500 max-w-sm">This telemetry dashboard is restricted to platform SuperOwners only.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-gradient-to-b from-[#F7F7FA] via-[#FCFCFD] to-[#EBEBFF] text-[#16182B] px-8 py-8 relative">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-[#ECEBFF] opacity-70 blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-10 -z-10 h-96 w-96 rounded-full bg-blue-100/40 opacity-50 blur-3xl pointer-events-none" />

      {/* Top bar with back button */}
      <div className="relative z-10 max-w-7xl mx-auto flex items-center justify-between border-b border-[#DEDDE6]/50 pb-5 mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4636D7] to-[#8B5CF6] text-white shadow-md shadow-indigo-200">
            <Activity className="h-5.5 w-5.5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[#16182B]">Latency Monitor</h1>
            <p className="text-[10px] text-slate-500 font-medium">Real-time platform latency telemetry</p>
          </div>
        </div>
        <button
          onClick={() => router.push("/super-admin")}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 hover:text-[#4636D7] bg-white border border-[#DEDDE6] hover:border-[#4636D7]/20 rounded-xl transition-all shadow-sm"
        >
          <ArrowLeft size={14} />
          กลับหน้า SuperAdmin
        </button>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <AdminMonitor />
      </div>
    </div>
  );
}
