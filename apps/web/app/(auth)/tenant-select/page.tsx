"use client";

import { Building2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Button, Card } from "@omnichat/ui";
import { apiFetch } from "../../lib/api-client";

type TenantMembership = {
  membershipId: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantLogoUrl: string | null;
  workspaceId: string;
  workspaceName: string;
  isDefaultWorkspace: boolean;
  role: string;
};

type SwitchTenantResponse = {
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  user: {
    id: string;
    email: string;
    displayName: string;
    tenantId: string;
    workspaceId: string;
    role: string;
  };
};

const SESSION_KEYS = {
  accessToken: "omnichat.accessToken",
  refreshToken: "omnichat.refreshToken",
  user: "omnichat.user"
} as const;

export default function TenantSelectPage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    apiFetch<TenantMembership[]>("/api/v1/auth/memberships")
      .then((data) => {
        if (active) {
          setMemberships(Array.isArray(data) ? data : []);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load tenants.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function switchTenant(workspaceId: string): Promise<void> {
    setSelectedWorkspaceId(workspaceId);
    setError(null);
    try {
      const nextSession = await apiFetch<SwitchTenantResponse>("/api/v1/auth/switch-tenant", {
        body: JSON.stringify({ workspaceId }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      window.localStorage.setItem(SESSION_KEYS.accessToken, nextSession.tokens.accessToken);
      window.localStorage.setItem(SESSION_KEYS.refreshToken, nextSession.tokens.refreshToken);
      window.localStorage.setItem(SESSION_KEYS.user, JSON.stringify(nextSession.user));
      document.cookie = `omnichat.accessToken=${encodeURIComponent(nextSession.tokens.accessToken)}; path=/; max-age=${15 * 60}; SameSite=Lax`;
      document.cookie = `omnichat.tenantId=${encodeURIComponent(nextSession.user.tenantId)}; path=/; max-age=${15 * 60}; SameSite=Lax`;
      document.cookie = `omnichat.workspaceId=${encodeURIComponent(nextSession.user.workspaceId)}; path=/; max-age=${15 * 60}; SameSite=Lax`;
      router.push("/app/inbox");
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : "Could not switch tenant.");
      setSelectedWorkspaceId(null);
    }
  }

  return (
    <section className="w-[520px] max-w-[calc(100vw-32px)] space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-medium">Select workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose active tenant workspace for this session.
        </p>
      </div>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-3">
        {isLoading ? (
          <Card className="p-4 text-sm text-muted-foreground">Loading workspaces...</Card>
        ) : null}
        {!isLoading && memberships.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No active tenant workspace found.</Card>
        ) : null}
        {memberships.map((membership) => (
          <Card
            key={membership.membershipId}
            className="flex items-center justify-between gap-4 p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-primary">
                <Building2 size={18} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-heading text-base font-medium">
                    {membership.tenantName}
                  </h2>
                  <Badge variant="muted">{membership.role}</Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  <span>{membership.workspaceName}</span>
                  {membership.isDefaultWorkspace ? " · Default" : ""}
                </p>
              </div>
            </div>
            <Button
              aria-label={`Use ${membership.tenantName} ${membership.workspaceName}`}
              disabled={selectedWorkspaceId !== null}
              onClick={() => void switchTenant(membership.workspaceId)}
              size="sm"
              type="button"
            >
              {selectedWorkspaceId === membership.workspaceId ? (
                <CheckCircle2 size={14} aria-hidden="true" />
              ) : null}
              Use
            </Button>
          </Card>
        ))}
      </div>
    </section>
  );
}
