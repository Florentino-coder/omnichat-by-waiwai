"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Users, LogOut, ArrowRight, RefreshCw, Activity, Brain, Database, MessageSquare } from "lucide-react";
import { Badge, Button, Card, Input, Label } from "@omnichat/ui";
import { apiFetch } from "../lib/api-client";
import { clearAuthSessionCookies } from "../lib/session-cookies";
import { useSuperOwnerGate } from "../lib/use-super-owner-gate";

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  planId: string;
  isActive: boolean;
  createdAt: string;
  userCount: number;
}

export default function SuperAdminPage() {
  const router = useRouter();
  const { isLoading: isAuthGateLoading, isReady: isAuthenticated } = useSuperOwnerGate();
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [tenantName, setTenantName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerDisplayName, setOwnerDisplayName] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerUsername, setOwnerUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadTenants = async () => {
    setIsLoadingTenants(true);
    setError(null);
    try {
      const data = await apiFetch<TenantInfo[]>("/api/v1/super-admin/tenants");
      setTenants(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenants list.");
    } finally {
      setIsLoadingTenants(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void loadTenants();
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    window.localStorage.removeItem("omnichat.accessToken");
    window.localStorage.removeItem("omnichat.refreshToken");
    window.localStorage.removeItem("omnichat.user");
    clearAuthSessionCookies();
    router.push("/login");
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!tenantName || !ownerEmail || !ownerDisplayName || !ownerPassword) {
      setError("Please fill in all required fields.");
      return;
    }

    if (ownerPassword.length < 8) {
      setError("Owner password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        tenantName,
        ownerEmail,
        ownerDisplayName,
        ownerPassword,
        ...(ownerUsername ? { ownerUsername } : {})
      };

      await apiFetch("/api/v1/super-admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      setSuccessMessage(`Tenant "${tenantName}" with Owner "${ownerDisplayName}" created successfully!`);
      setTenantName("");
      setOwnerEmail("");
      setOwnerDisplayName("");
      setOwnerPassword("");
      setOwnerUsername("");
      void loadTenants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tenant.");
    } finally {
      setIsSubmitting(false);
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

      {/* Header */}
      <header className="relative z-10 border-b border-white/50 bg-white/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4636D7] to-[#8B5CF6] text-white shadow-md shadow-indigo-200">
              <MessageSquare className="h-5.5 w-5.5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[#16182B] flex items-center gap-2">
                ChatWai 
                <span className="text-[#4636D7] font-semibold text-xs bg-[#ECEBFF] px-2 py-0.5 rounded-full border border-[#4636D7]/10">Console</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-medium leading-none mt-1">Platform Management Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => router.push("/super-admin/backups")}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 hover:text-[#4636D7] bg-white border border-[#DEDDE6] hover:border-[#4636D7]/20 rounded-xl transition-all shadow-sm"
            >
              <Database size={14} />
              Backups
            </button>
            <button
              onClick={() => router.push("/super-admin/ai")}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 hover:text-[#4636D7] bg-white border border-[#DEDDE6] hover:border-[#4636D7]/20 rounded-xl transition-all shadow-sm"
            >
              <Brain size={14} />
              AI Monitor
            </button>
            <button
              onClick={() => router.push("/app/admin/monitor")}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 hover:text-[#4636D7] bg-white border border-[#DEDDE6] hover:border-[#4636D7]/20 rounded-xl transition-all shadow-sm"
            >
              <Activity size={14} />
              Latency Monitor
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

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Create Tenant Form */}
        <section className="lg:col-span-5">
          <Card className="bg-white/80 border-[#DEDDE6]/50 shadow-xl shadow-indigo-150/10 p-6 rounded-2xl backdrop-blur-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-sky-50 text-sky-600 p-2.5 rounded-xl border border-sky-100">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#16182B]">Create New Tenant</h2>
                <p className="text-xs text-slate-500">Provision a workspace & owner account</p>
              </div>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tenantName" className="text-slate-700 font-bold text-xs">Tenant Business Name *</Label>
                <Input
                  id="tenantName"
                  className="bg-white border-[#DEDDE6] text-[#16182B] placeholder:text-slate-400 focus:border-[#4636D7] rounded-xl text-sm"
                  placeholder="e.g. Jinbao Corp"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <Label htmlFor="ownerDisplayName" className="text-slate-700 font-bold text-xs">Owner Display Name *</Label>
                <Input
                  id="ownerDisplayName"
                  className="bg-white border-[#DEDDE6] text-[#16182B] placeholder:text-slate-400 focus:border-[#4636D7] rounded-xl text-sm"
                  placeholder="e.g. Somchai Sookjai"
                  value={ownerDisplayName}
                  onChange={(e) => setOwnerDisplayName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ownerEmail" className="text-slate-700 font-bold text-xs">Owner Email *</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  className="bg-white border-[#DEDDE6] text-[#16182B] placeholder:text-slate-400 focus:border-[#4636D7] rounded-xl text-sm"
                  placeholder="e.g. somchai@gmail.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ownerUsername" className="text-slate-700 font-bold text-xs">Owner Username <span className="text-slate-400 font-normal">(Optional)</span></Label>
                <Input
                  id="ownerUsername"
                  className="bg-white border-[#DEDDE6] text-[#16182B] placeholder:text-slate-400 focus:border-[#4636D7] rounded-xl text-sm"
                  placeholder="e.g. somchaiofficial"
                  value={ownerUsername}
                  onChange={(e) => setOwnerUsername(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ownerPassword" className="text-slate-700 font-bold text-xs">Owner Password *</Label>
                <Input
                  id="ownerPassword"
                  type="password"
                  className="bg-white border-[#DEDDE6] text-[#16182B] placeholder:text-slate-400 focus:border-[#4636D7] rounded-xl text-sm"
                  placeholder="••••••••"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {error && (
                <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-medium">
                  {successMessage}
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#4636D7] hover:bg-[#382BB5] text-white font-bold h-11 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 mt-4"
              >
                {isSubmitting ? "Creating Tenant..." : (
                  <>
                    <Plus size={16} />
                    Create Tenant & Owner
                    <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </form>
          </Card>
        </section>

        {/* Right: Tenant Directory Table */}
        <section className="lg:col-span-7">
          <Card className="bg-white/80 border-[#DEDDE6]/50 shadow-xl shadow-indigo-150/10 p-6 rounded-2xl backdrop-blur-md min-h-[500px] flex flex-col justify-between">
            <div className="flex-grow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl border border-indigo-100">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#16182B]">Active Tenants Directory</h2>
                    <p className="text-xs text-slate-500">Total registered tenants on the platform</p>
                  </div>
                </div>
                <button
                  onClick={loadTenants}
                  className="p-2 text-slate-500 hover:text-[#4636D7] hover:bg-slate-100 rounded-xl transition-all border border-slate-200/60"
                  title="Refresh List"
                  disabled={isLoadingTenants}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingTenants ? "animate-spin text-[#4636D7]" : ""}`} />
                </button>
              </div>

              {isLoadingTenants && tenants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-xs font-medium">
                  <RefreshCw className="h-8 w-8 animate-spin text-[#4636D7]/50 mb-3" />
                  Loading tenants list...
                </div>
              ) : tenants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-xs font-medium border border-dashed border-slate-200 rounded-2xl">
                  <Building2 className="h-12 w-12 text-slate-300 mb-3" />
                  No tenants registered yet.
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#DEDDE6]/60 rounded-xl shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-[#DEDDE6]/60 text-slate-500 font-bold">
                        <th className="px-4 py-3">Business Name</th>
                        <th className="px-4 py-3">Slug</th>
                        <th className="px-4 py-3">Plan</th>
                        <th className="px-4 py-3 text-center">Users</th>
                        <th className="px-4 py-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {tenants.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-[#16182B]">{t.name}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">{t.slug}</td>
                          <td className="px-4 py-3">
                            <Badge className="bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-semibold px-2 py-0.5">
                              {t.planId.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600 font-medium">
                            <div className="flex items-center justify-center gap-1">
                              <Users size={12} className="text-slate-400" />
                              {t.userCount}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </section>

      </main>
    </div>
  );
}
