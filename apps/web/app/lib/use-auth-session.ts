"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./api-client";

export type AuthSessionUser = {
  id: string;
  email: string;
  displayName: string;
  tenantId?: string;
  workspaceId?: string;
  role?: string;
  isSuperOwner?: boolean;
};

type AuthSessionState = {
  user: AuthSessionUser | null;
  isLoading: boolean;
  error: string | null;
};

export function useAuthSession(): AuthSessionState {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    apiFetch<AuthSessionUser>("/api/v1/auth/me")
      .then((sessionUser) => {
        if (active) {
          setUser(sessionUser);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setUser(null);
          setError(loadError instanceof Error ? loadError.message : "Could not load session.");
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

  return { user, isLoading, error };
}
