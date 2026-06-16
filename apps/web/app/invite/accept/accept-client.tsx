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
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section aria-labelledby="invite-heading" className="w-[380px] max-w-[calc(100vw-32px)] space-y-5 rounded-lg border border-border bg-card p-6">
        <div>
          <h1 id="invite-heading" className="font-heading text-xl font-medium">
            Accept invite
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Create your OmniChat account.</p>
        </div>
        {invitation ? (
          <div className="rounded-md border border-border bg-secondary px-3 py-2 text-sm">
            <p className="font-medium">{invitation.tenant?.name ?? "OmniChat"}</p>
            <p className="text-muted-foreground">
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
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              placeholder="e.g. johndoe"
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              value={username}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              autoComplete="name"
              placeholder="e.g. John Doe"
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              onChange={(event) => setPassword(event.target.value)}
              value={password}
            />
          </div>
          <Button className="w-full" disabled={isSubmitting || !token} type="submit">
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
