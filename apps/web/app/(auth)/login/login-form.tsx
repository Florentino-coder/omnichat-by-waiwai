"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button, Input, Label } from "@omnichat/ui";
import { loginSchema } from "../../../lib/schemas/auth";
import { setAuthSessionCookies } from "../../lib/session-cookies";

interface LoginSuccess {
  success: true;
  data: {
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
}

interface ErrorBody {
  message?: string;
  error?: {
    message?: string;
  };
}

const SESSION_KEYS = {
  accessToken: "omnichat.accessToken",
  refreshToken: "omnichat.refreshToken",
  user: "omnichat.user"
} as const;

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError("Enter a valid email/username and a password with at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/auth/login", {
        body: JSON.stringify(parsed.data),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        setError(readErrorMessage(body));
        return;
      }

      const login = body as LoginSuccess & { data: { user: { isSuperOwner?: boolean } } };
      window.localStorage.setItem(SESSION_KEYS.accessToken, login.data.tokens.accessToken);
      window.localStorage.setItem(SESSION_KEYS.refreshToken, login.data.tokens.refreshToken);
      window.localStorage.setItem(SESSION_KEYS.user, JSON.stringify(login.data.user));
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
      <div className="space-y-2">
        <Label htmlFor="email" className="text-white font-medium">Email or Username</Label>
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
        <Label htmlFor="password" className="text-white font-medium">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
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
