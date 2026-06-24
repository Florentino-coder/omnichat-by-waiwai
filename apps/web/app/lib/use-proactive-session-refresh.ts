"use client";

import { useEffect } from "react";
import { refreshAccessToken } from "./api-client";
import { ACCESS_TOKEN_REFRESH_INTERVAL_MS } from "./auth-cookie-names";

export function useProactiveSessionRefresh(): void {
  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        void refreshAccessToken();
      }
    }

    refreshIfVisible();
    const intervalId = window.setInterval(refreshIfVisible, ACCESS_TOKEN_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, []);
}
