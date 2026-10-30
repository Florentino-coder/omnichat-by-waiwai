"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button, Input, Label } from "@omnichat/ui";
import { loginSchema } from "../../../lib/schemas/auth";
import { clearLegacyAuthStorage } from "../../lib/api-client";
import { setAuthSessionCookies } from "../../lib/session-cookies";

interface LoginSuccess {
  success: true;
  data: {
    user: {
      id: string;
      email: string;
      displayName: string;
      tenantId?: string;
      workspaceId?: string;
      role?: string;
      isSuperOwner?: boolean;
    };
  };
}

interface ErrorBody {
  message?: string;
  error?: {
    message?: string;
  };
}

const TOTP_REQUIRED_MESSAGE = "Two-factor code is required";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuperOwnerNotice, setShowSuperOwnerNotice] = useState(false);

  useEffect(() => {
    setShowSuperOwnerNotice(
      new URLSearchParams(window.location.search).get("notice") === "super-owner-required"
    );
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({
      email,
      password,
      ...(needsTotp ? { totpCode: totpCode.trim() } : {})
    });
    if (!parsed.success) {
      setError(
        needsTotp
          ? "Enter the 6-digit code from your authenticator app."
          : "Enter a valid email/username and a password with at least 8 characters."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/auth/login", {
        body: JSON.stringify(parsed.data),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        const message = readErrorMessage(body);
        if (message === TOTP_REQUIRED_MESSAGE) {
          setNeedsTotp(true);
          setError("Enter the 6-digit code from your authenticator app.");
          return;
        }
        setError(message);
        return;
      }

      const login = body as LoginSuccess;
      clearLegacyAuthStorage();
      setAuthSessionCookies({ isSuperOwner: Boolean(login.data.user.isSuperOwner) });
      if (login.data.user.isSuperOwner) {
        router.push("/super-admin");
      } else {
        router.push("/tenant-select");
      }
    } catch {
      setError("Cannot sign in right now. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {showSuperOwnerNotice ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
          This account cannot open the platform console. Sign in with the Super Admin account.
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-[#16182B] font-medium">Email or Username</Label>
        <Input
          id="email"
          type="text"
          placeholder="e.g. owner or owner@omnichat.local"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-[#16182B] font-medium">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {needsTotp ? (
        <div className="space-y-2">
          <Label htmlFor="totp-code" className="text-[#16182B] font-medium">Authenticator code</Label>
          <Input
            id="totp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={totpCode}
            onChange={(event) => setTotpCode(event.target.value)}
          />
        </div>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/30 transition-all" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

function readErrorMessage(body: unknown): string {
  if (!isErrorBody(body)) {
    return "Invalid email or password";
  }

  return body.error?.message ?? body.message ?? "Invalid email or password";
}

function isErrorBody(value: unknown): value is ErrorBody {
  return typeof value === "object" && value !== null;
}
