"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button, Card, Input, Label } from "@omnichat/ui";
import { apiFetch, authorizedFetch } from "../../lib/api-client";
import { useAuthSession } from "../../lib/use-auth-session";

function readSecret(otpauthUri: string): string {
  try {
    return new URL(otpauthUri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

export default function SuperAdminSecurityPage() {
  const router = useRouter();
  const { user, isLoading } = useAuthSession();
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!user?.isSuperOwner) {
      router.replace("/login");
    } else if (user.twoFaEnabled) {
      router.replace("/super-admin");
    }
  }, [isLoading, router, user]);

  async function onStart(): Promise<void> {
    setIsBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ otpauthUri: string }>("/api/v1/auth/2fa/super-owner/setup", {
        method: "POST"
      });
      setOtpauthUri(result.otpauthUri);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start setup. Try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function onVerify(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      const response = await authorizedFetch("/api/v1/auth/2fa/super-owner/verify", {
        method: "POST",
        body: JSON.stringify({ code: code.trim() })
      });
      if (!response.ok) {
        setError("That code did not match. Check your authenticator app and try again.");
        return;
      }
      // Full reload so the session is read again with 2FA enabled.
      window.location.assign("/super-admin");
    } catch {
      setError("Could not verify the code. Try again.");
    } finally {
      setIsBusy(false);
    }
  }

  if (isLoading || !user?.isSuperOwner || user.twoFaEnabled) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F7FA] p-4">
      <Card className="w-full max-w-md space-y-5 bg-white p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-[#4636D7]" aria-hidden="true" />
          <h1 className="font-heading text-lg font-semibold text-[#16182B]">Set up two-factor authentication</h1>
        </div>
        <p className="text-sm text-[#767A8C]">
          The platform console can reach every tenant, so it requires an authenticator app such as Google
          Authenticator.
        </p>

        {otpauthUri ? (
          <form className="space-y-4" onSubmit={(event) => void onVerify(event)}>
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#16182B]">1. Add this setup key to your app</p>
              <p className="rounded-lg bg-[#F6F5FA] p-3 font-mono text-sm break-all" data-testid="totp-secret">
                {readSecret(otpauthUri)}
              </p>
              <a className="text-xs font-medium text-[#4636D7] underline" href={otpauthUri}>
                Open in authenticator app
              </a>
            </div>
            <div className="space-y-2">
              <Label htmlFor="totp-code">2. Enter the 6-digit code</Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <Button className="w-full" type="submit" disabled={isBusy || code.trim().length !== 6}>
              {isBusy ? "Checking..." : "Turn on two-factor authentication"}
            </Button>
          </form>
        ) : (
          <div className="space-y-3">
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <Button className="w-full" type="button" disabled={isBusy} onClick={() => void onStart()}>
              {isBusy ? "Starting..." : "Start setup"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
