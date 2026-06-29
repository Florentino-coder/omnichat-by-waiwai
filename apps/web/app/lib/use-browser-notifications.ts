"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getNotificationPermission,
  isNotificationSupported,
  readDesktopNotificationsPref,
  requestNotificationPermission,
  writeDesktopNotificationsPref
} from "./browser-notifications";

export function useBrowserNotifications() {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(isNotificationSupported());
    setEnabled(readDesktopNotificationsPref());
    setPermission(getNotificationPermission());
  }, []);

  const setPrefEnabled = useCallback((next: boolean) => {
    writeDesktopNotificationsPref(next);
    setEnabled(next);
  }, []);

  const requestPermission = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
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
