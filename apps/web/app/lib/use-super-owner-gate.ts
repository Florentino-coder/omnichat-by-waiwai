"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkSuperOwnerAccess } from "./super-owner-access";
import { useAuthSession } from "./use-auth-session";

const SESSION_RETRY_MS = 5000;

type SuperOwnerGateOptions = {
  /** Redirect when logged in but not a super owner. Defaults to `/login`. */
  deniedRedirect?: string;
  /** Redirect when there is no session. Defaults to `/login`. */
  unauthenticatedRedirect?: string;
  /** Skip the secondary API probe when auth/me already confirmed super owner. */
  skipApiVerify?: boolean;
};

type SuperOwnerGateState = {
  isLoading: boolean;
  isReady: boolean;
  isDenied: boolean;
};

export function useSuperOwnerGate(options: SuperOwnerGateOptions = {}): SuperOwnerGateState {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, error: sessionError } = useAuthSession();
  const deniedRedirect = options.deniedRedirect ?? "/login";
  const unauthenticatedRedirect = options.unauthenticatedRedirect ?? "/login";
  const skipApiVerify = options.skipApiVerify ?? false;

  const [apiVerified, setApiVerified] = useState(false);
  const [apiVerifying, setApiVerifying] = useState(false);
  const [isDenied, setIsDenied] = useState(false);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!user && sessionError) {
      // The session check itself failed, for example while the API wakes up. That
      // is not proof of being signed out, and a real 401 already redirects in
      // apiFetch, so keep waiting and try again.
      const retry = window.setTimeout(() => window.location.reload(), SESSION_RETRY_MS);
      return () => window.clearTimeout(retry);
    }

    if (!user) {
      router.replace(unauthenticatedRedirect);
      return;
    }

    if (!user.isSuperOwner) {
      setIsDenied(true);
      router.replace(deniedRedirect);
      return;
    }

    if (user.twoFaEnabled === false) {
      router.replace("/super-admin/security");
      return;
    }

    if (skipApiVerify) {
      setApiVerified(true);
      return;
    }

    let active = true;
    setApiVerifying(true);

    void checkSuperOwnerAccess().then((access) => {
      if (!active) {
        return;
      }
      setApiVerifying(false);
      if (access === "two-fa-required") {
        router.replace("/super-admin/security");
        return;
      }
      if (access === "denied") {
        setIsDenied(true);
        router.replace(deniedRedirect);
        return;
      }
      setApiVerified(true);
    });

    return () => {
      active = false;
    };
  }, [
    isAuthLoading,
    user,
    sessionError,
    deniedRedirect,
    unauthenticatedRedirect,
    skipApiVerify,
    router
  ]);

  const isReady =
    !isAuthLoading && Boolean(user?.isSuperOwner) && (skipApiVerify || apiVerified);
  const isLoading =
    isAuthLoading ||
    apiVerifying ||
    Boolean(!user && sessionError) ||
    (Boolean(user?.isSuperOwner) && !skipApiVerify && !apiVerified && !isDenied);

  return { isLoading, isReady, isDenied };
}
