export const DESKTOP_NOTIFICATIONS_KEY = "omnichat.desktopNotifications";

const notifiedMessageIds = new Set<string>();

export function readDesktopNotificationsPref(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(DESKTOP_NOTIFICATIONS_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeDesktopNotificationsPref(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore storage failures in private browsing.
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** User is not actively viewing this browser tab (another tab or another app has focus). */
export function shouldShowDesktopNotification(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const pageHasFocus =
    typeof document.hasFocus === "function" ? document.hasFocus() : !document.hidden;
  return document.hidden || !pageHasFocus;
}

export function canShowDesktopNotification(): boolean {
  if (!isNotificationSupported()) {
    return false;
  }
  return Notification.permission === "granted" && readDesktopNotificationsPref();
}

export function syncNotificationPermission(): NotificationPermission | "unsupported" {
  return getNotificationPermission();
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNotificationSupported()) {
    return "unsupported";
  }
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

export function showInboundMessageNotification(options: {
  messageId: string;
  customerName: string;
  conversationId: string;
  body?: string;
  onSelectConversation: (conversationId: string) => void;
}): void {
  if (!canShowDesktopNotification()) {
    return;
  }
  if (notifiedMessageIds.has(options.messageId)) {
    return;
  }
  notifiedMessageIds.add(options.messageId);

  const notification = new Notification(options.customerName, {
    body: options.body ?? "New inbound message",
    tag: options.messageId
  });

  notification.onclick = () => {
    window.focus();
    options.onSelectConversation(options.conversationId);
    notification.close();
  };
}

export function resetNotifiedMessageIdsForTests(): void {
  notifiedMessageIds.clear();
}
