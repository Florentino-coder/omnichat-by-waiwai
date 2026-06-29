import {
  readDesktopNotificationsPref,
  resetNotifiedMessageIdsForTests,
  shouldShowDesktopNotification,
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
    writeDesktopNotificationsPref(true);

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

  it("shows when tab hidden or window lost focus", () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    jest.spyOn(document, "hasFocus").mockReturnValue(true);
    expect(shouldShowDesktopNotification()).toBe(true);

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    jest.spyOn(document, "hasFocus").mockReturnValue(false);
    expect(shouldShowDesktopNotification()).toBe(true);

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    jest.spyOn(document, "hasFocus").mockReturnValue(true);
    expect(shouldShowDesktopNotification()).toBe(false);
  });
});
