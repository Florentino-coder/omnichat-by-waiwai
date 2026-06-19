"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import AdminMonitor from "../../../../components/monitor/admin-monitor";

export default function AdminMonitorPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const userStr = window.localStorage.getItem("omnichat.user");
    if (!userStr) {
      router.replace("/login");
      return;
    }
    try {
      const user = JSON.parse(userStr);
      if (user.isSuperOwner === true) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
        // Redirect non-superowners back to the standard inbox
        router.replace("/app/inbox");
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  if (isAuthorized === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500 font-medium">Verifying access rights...</p>
      </div>
    );
  }

  if (isAuthorized === false) {
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
