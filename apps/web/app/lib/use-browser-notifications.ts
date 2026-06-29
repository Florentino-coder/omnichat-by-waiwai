"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isNotificationSupported,
  readDesktopNotificationsPref,
  requestNotificationPermission,
  syncNotificationPermission,
  writeDesktopNotificationsPref
} from "./browser-notifications";

function readNotificationState(): {
  enabled: boolean;
  permission: NotificationPermission | "unsupported";
  supported: boolean;
} {
  return {
    supported: isNotificationSupported(),
    enabled: readDesktopNotificationsPref(),
    permission: syncNotificationPermission()
  };
}

export function useBrowserNotifications() {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = readNotificationState();
      setSupported(next.supported);
      setEnabled(next.enabled);
      setPermission(next.permission);
    };

    sync();

    const onVisibilityChange = () => sync();
    const onFocus = () => sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "omnichat.desktopNotifications") {
        sync();
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const setPrefEnabled = useCallback((next: boolean) => {
    writeDesktopNotificationsPref(next);
    setEnabled(next);
    setPermission(syncNotificationPermission());
  }, []);

  const requestPermission = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    setEnabled(readDesktopNotificationsPref());
    return result;
  }, []);

  return {
    enabled,
    permission,
    supported,
    setPrefEnabled,
    requestPermission
  };
}
