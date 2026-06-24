"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Users, LogOut, ArrowRight, ShieldCheck, RefreshCw, Activity, Brain, Database } from "lucide-react";
import { Badge, Button, Card, Input, Label } from "@omnichat/ui";
import { apiFetch } from "../lib/api-client";
import { clearAuthSessionCookies } from "../lib/session-cookies";
import { verifySuperOwnerAccess } from "../lib/super-owner-access";

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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

  if (!isAuthenticated) {
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
      {/* Background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-sky-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/30">
              <ShieldCheck className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white font-sans">
                Chat-Wai <span className="text-indigo-400 font-medium text-sm border border-indigo-500/30 px-2 py-0.5 rounded-full ml-2">Console</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Platform Management Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/super-admin/backups")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-sky-300 hover:text-white bg-sky-950/40 hover:bg-sky-900/40 border border-sky-900/50 hover:border-sky-700 rounded-xl transition-all"
            >
              <Database size={16} />
              Backups
            </button>
            <button
              onClick={() => router.push("/super-admin/ai")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-violet-300 hover:text-white bg-violet-950/40 hover:bg-violet-900/40 border border-violet-900/50 hover:border-violet-700 rounded-xl transition-all"
            >
              <Brain size={16} />
              AI Monitor
            </button>
            <button
              onClick={() => router.push("/app/admin/monitor")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-indigo-300 hover:text-white bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-900/50 hover:border-indigo-700 rounded-xl transition-all"
            >
              <Activity size={16} />
              Latency Monitor
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

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Create Tenant Form */}
        <section className="lg:col-span-5">
          <Card className="bg-slate-900/80 border-slate-800 shadow-2xl p-6 rounded-2xl backdrop-blur-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-sky-500/20 p-2 rounded-xl border border-sky-500/20">
                <Building2 className="h-5 w-5 text-sky-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Create New Tenant</h2>
                <p className="text-xs text-slate-400">Provision a workspace & owner account</p>
              </div>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tenantName" className="text-slate-300 font-medium text-xs">Tenant Business Name *</Label>
                <Input
                  id="tenantName"
                  className="bg-slate-950/80 border-slate-800 text-white placeholder:text-slate-600 focus:border-indigo-500 rounded-xl text-sm"
                  placeholder="e.g. Jinbao Corp"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                <Label htmlFor="ownerDisplayName" className="text-slate-300 font-medium text-xs">Owner Display Name *</Label>
                <Input
                  id="ownerDisplayName"
                  className="bg-slate-950/80 border-slate-800 text-white placeholder:text-slate-600 focus:border-indigo-500 rounded-xl text-sm"
                  placeholder="e.g. Somchai Sookjai"
                  value={ownerDisplayName}
                  onChange={(e) => setOwnerDisplayName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ownerEmail" className="text-slate-300 font-medium text-xs">Owner Email *</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  className="bg-slate-950/80 border-slate-800 text-white placeholder:text-slate-600 focus:border-indigo-500 rounded-xl text-sm"
                  placeholder="e.g. somchai@gmail.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ownerUsername" className="text-slate-300 font-medium text-xs">Owner Username <span className="text-slate-500">(Optional)</span></Label>
                <Input
                  id="ownerUsername"
                  className="bg-slate-950/80 border-slate-800 text-white placeholder:text-slate-600 focus:border-indigo-500 rounded-xl text-sm"
                  placeholder="e.g. somchaiofficial"
                  value={ownerUsername}
                  onChange={(e) => setOwnerUsername(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ownerPassword" className="text-slate-300 font-medium text-xs">Owner Password *</Label>
                <Input
                  id="ownerPassword"
                  type="password"
                  className="bg-slate-950/80 border-slate-800 text-white placeholder:text-slate-600 focus:border-indigo-500 rounded-xl text-sm"
                  placeholder="••••••••"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {error && (
                <div className="p-3 text-xs bg-red-950/40 border border-red-900/50 text-red-400 rounded-xl">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="p-3 text-xs bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 rounded-xl">
                  {successMessage}
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 mt-4"
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
          <Card className="bg-slate-900/80 border-slate-800 shadow-2xl p-6 rounded-2xl backdrop-blur-md min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-500/20 p-2 rounded-xl border border-indigo-500/20">
                  <Building2 className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Active Tenants Directory</h2>
                  <p className="text-xs text-slate-400">Total registered tenants on the platform</p>
                </div>
              </div>
              <button
                onClick={loadTenants}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-850"
                title="Refresh List"
                disabled={isLoadingTenants}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingTenants ? "animate-spin text-indigo-400" : ""}`} />
              </button>
            </div>

            {isLoadingTenants && tenants.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 text-sm">
                <RefreshCw className="h-8 w-8 animate-spin text-indigo-500/50 mb-3" />
                Loading tenants list...
              </div>
            ) : tenants.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
                <Building2 className="h-12 w-12 text-slate-700 mb-3" />
                No tenants registered yet.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-800/80 rounded-xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold text-xs">
                      <th className="px-4 py-3">Business Name</th>
                      <th className="px-4 py-3">Slug</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3 text-center">Users</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 bg-slate-900/40">
                    {tenants.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white">{t.name}</td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{t.slug}</td>
                        <td className="px-4 py-3">
                          <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold px-2 py-0.5">
                            {t.planId.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-300 font-medium">
                          <div className="flex items-center justify-center gap-1">
                            <Users size={12} className="text-slate-500" />
                            {t.userCount}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>

      </main>
    </div>
  );
}
