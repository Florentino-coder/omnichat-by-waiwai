"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { verifySuperOwnerAccess } from "./super-owner-access";
import { useAuthSession } from "./use-auth-session";

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
  const { user, isLoading: isAuthLoading } = useAuthSession();
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

    if (!user) {
      router.replace(unauthenticatedRedirect);
      return;
    }

    if (!user.isSuperOwner) {
      setIsDenied(true);
      router.replace(deniedRedirect);
      return;
    }

    if (skipApiVerify) {
      setApiVerified(true);
      return;
    }

    let active = true;
    setApiVerifying(true);

    void verifySuperOwnerAccess().then((allowed) => {
      if (!active) {
        return;
      }
      setApiVerifying(false);
      if (!allowed) {
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
    (Boolean(user?.isSuperOwner) && !skipApiVerify && !apiVerified && !isDenied);

  return { isLoading, isReady, isDenied };
}
