import {
  readDesktopNotificationsPref,
  resetNotifiedMessageIdsForTests,
  showInboundMessageNotification,
  writeDesktopNotificationsPref
} from "../app/lib/browser-notifications";

describe("browser-notifications", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetNotifiedMessageIdsForTests();
  });

  it("stores desktop notification preference in localStorage", () => {
    expect(readDesktopNotificationsPref()).toBe(false);
    writeDesktopNotificationsPref(true);
    expect(readDesktopNotificationsPref()).toBe(true);
  });

  it("dedupes notifications by message id", () => {
    const notificationMock = jest.fn();
    class MockNotification {
      static permission: NotificationPermission = "granted";
      onclick: (() => void) | null = null;
      constructor(public title: string, public options?: NotificationOptions) {
        notificationMock(title, options);
      }
      close() {}
    }
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: MockNotification
    });

    const onSelectConversation = jest.fn();
    showInboundMessageNotification({
      messageId: "message-1",
      customerName: "Customer",
      conversationId: "conversation-1",
      onSelectConversation
    });
    showInboundMessageNotification({
      messageId: "message-1",
      customerName: "Customer",
      conversationId: "conversation-1",
      onSelectConversation
    });

    expect(notificationMock).toHaveBeenCalledTimes(1);
  });
});
