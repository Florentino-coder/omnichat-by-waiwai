"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Label } from "@omnichat/ui";
import { invitationAcceptSchema } from "../../../lib/schemas/auth";

type InvitationContext = {
  email: string;
  role: string;
  tenant?: {
    name: string;
  };
  workspace?: {
    name: string;
  };
};

type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error?: { message?: string }; message?: string };

export function AcceptInviteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [invitation, setInvitation] = useState<InvitationContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    async function verify(): Promise<void> {
      if (!token) {
        setError("Invitation token is required.");
        return;
      }
      try {
        const response = await fetch(`/api/v1/invitations/verify/${encodeURIComponent(token)}`);
        const body = (await response.json().catch(() => null)) as ApiEnvelope<InvitationContext> | null;
        if (!response.ok || !body || !body.success) {
          throw new Error(readEnvelopeError(body) ?? "Invitation is invalid or expired.");
        }
        if (active) {
          setInvitation(body.data);
        }
      } catch (verifyError) {
        if (active) {
          setError(readMessage(verifyError, "Invitation is invalid or expired."));
        }
      }
    }

    void verify();
    return () => {
      active = false;
    };
  }, [token]);

  async function submitInvite(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const parsed = invitationAcceptSchema.safeParse({ token, username, displayName, password });
    if (!parsed.success) {
      const issues = parsed.error.format();
      const userError = issues.username?._errors[0] || issues.displayName?._errors[0] || issues.password?._errors[0] || "Please enter all details correctly.";
      setError(userError);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/invitations/accept/${encodeURIComponent(token)}`, {
        body: JSON.stringify({
          username: parsed.data.username,
          displayName: parsed.data.displayName,
          password: parsed.data.password
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const body = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;
      if (!response.ok || !body || !body.success) {
        throw new Error(readEnvelopeError(body) ?? "Could not accept invitation.");
      }
      router.push("/login");
    } catch (acceptError) {
      setError(readMessage(acceptError, "Could not accept invitation."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-8">
      <section aria-labelledby="invite-heading" className="w-[380px] max-w-[calc(100vw-32px)] space-y-5 rounded-lg border border-indigo-500/20 bg-slate-950/40 backdrop-blur-md p-6 shadow-2xl shadow-indigo-950/40 text-slate-100">
        <div>
          <h1 id="invite-heading" className="font-heading text-xl font-medium text-white">
            Accept invite
          </h1>
          <p className="mt-1 text-sm text-indigo-300/70">Create your Chat-Wai account.</p>
        </div>
        {invitation ? (
          <div className="rounded-md border border-indigo-500/10 bg-indigo-950/30 px-3 py-2 text-sm">
            <p className="font-medium text-white">{invitation.tenant?.name ?? "Chat-Wai"}</p>
            <p className="text-indigo-300/70">
              <span>{invitation.workspace?.name ?? "Workspace"}</span> · {invitation.role} · {invitation.email}
            </p>
          </div>
        ) : null}
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <form className="space-y-4" onSubmit={(event) => void submitInvite(event)}>
          <div className="space-y-2">
            <Label htmlFor="username" className="text-slate-200">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              placeholder="e.g. johndoe"
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              value={username}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-slate-200">Display name</Label>
            <Input
              id="displayName"
              autoComplete="name"
              placeholder="e.g. John Doe"
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-200">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              onChange={(event) => setPassword(event.target.value)}
              value={password}
            />
          </div>
          <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/30 transition-all" disabled={isSubmitting || !token} type="submit">
            {isSubmitting ? "Joining..." : "Join workspace"}
          </Button>
        </form>
      </section>
    </main>
  );
}

function readEnvelopeError<T>(body: ApiEnvelope<T> | null): string | null {
  return body && "error" in body ? body.error?.message ?? body.message ?? null : null;
}

function readMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
