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

export type DesktopNotificationContext = {
  /** Conversation that received the inbound message. */
  incomingConversationId: string;
  /** Conversation currently open in the inbox thread panel, if any. */
  activeConversationId?: string | null;
};

/**
 * Show a desktop notification when the user is not actively reading that thread:
 * - another tab/app has focus, or
 * - inbox tab is focused but a different conversation is selected (or none).
 */
export function shouldShowDesktopNotification(context?: DesktopNotificationContext): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const pageHasFocus =
    typeof document.hasFocus === "function" ? document.hasFocus() : !document.hidden;
  const tabInBackground = document.hidden || !pageHasFocus;

  if (tabInBackground) {
    return true;
  }

  if (context?.incomingConversationId) {
    const activeId = context.activeConversationId ?? null;
    return activeId !== context.incomingConversationId;
  }

  return false;
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

  try {
    const notification = new Notification(options.customerName, {
      body: options.body ?? "New inbound message",
      tag: options.messageId,
    });

    notifiedMessageIds.add(options.messageId);

    notification.onclick = () => {
      window.focus();
      options.onSelectConversation(options.conversationId);
      notification.close();
    };
  } catch {
    // Constructor can throw if permission was revoked or OS blocks notifications.
  }
}

/** Fires immediately — use from Settings to verify browser/OS notification setup. */
export function showTestDesktopNotification():
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "disabled" | "failed"; message?: string } {
  if (!isNotificationSupported()) {
    return { ok: false, reason: "unsupported" };
  }

  if (Notification.permission !== "granted") {
    return { ok: false, reason: "denied" };
  }

  if (!readDesktopNotificationsPref()) {
    return { ok: false, reason: "disabled" };
  }

  try {
    const stamp = Date.now();
    const notification = new Notification("OmniChat — ทดสอบ", {
      body: `ถ้าเห็นข้อความนี้ การแจ้งเตือนทำงานแล้ว (${new Date(stamp).toLocaleTimeString()})`,
      tag: `omnichat-test-${stamp}`,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return { ok: false, reason: "failed", message };
  }
}

export function resetNotifiedMessageIdsForTests(): void {
  notifiedMessageIds.clear();
}
