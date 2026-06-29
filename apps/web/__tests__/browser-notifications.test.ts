import {
  isInboundRealtimeDirection,
  notifyNewInboundFromConversationSnapshots,
  readDesktopNotificationsPref,
  resetNotifiedMessageIdsForTests,
  shouldShowDesktopNotification,
  showInboundMessageNotification,
  showTestDesktopNotification,
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

  it("shows when inbox tab focused but user is not viewing that conversation", () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    jest.spyOn(document, "hasFocus").mockReturnValue(true);

    expect(
      shouldShowDesktopNotification({
        incomingConversationId: "conversation-inbound",
        activeConversationId: null,
      })
    ).toBe(true);

    expect(
      shouldShowDesktopNotification({
        incomingConversationId: "conversation-inbound",
        activeConversationId: "conversation-other",
      })
    ).toBe(true);

    expect(
      shouldShowDesktopNotification({
        incomingConversationId: "conversation-inbound",
        activeConversationId: "conversation-inbound",
      })
    ).toBe(false);
  });

  it("fires test notification when permission and pref are granted", () => {
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

    const result = showTestDesktopNotification();
    expect(result).toEqual({ ok: true });
    expect(notificationMock).toHaveBeenCalledWith(
      "OmniChat — ทดสอบ",
      expect.objectContaining({ tag: expect.stringMatching(/^omnichat-test-\d+$/) })
    );

    const result2 = showTestDesktopNotification();
    expect(result2).toEqual({ ok: true });
    expect(notificationMock).toHaveBeenCalledTimes(2);
    const tags = notificationMock.mock.calls.map((call) => call[1]?.tag);
    expect(tags[0]).not.toBe(tags[1]);
  });

  it("treats missing SSE direction as inbound", () => {
    expect(isInboundRealtimeDirection(undefined)).toBe(true);
    expect(isInboundRealtimeDirection("INBOUND")).toBe(true);
    expect(isInboundRealtimeDirection("OUTBOUND")).toBe(false);
  });

  it("notifies when conversation list gains a new inbound preview", () => {
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

    notifyNewInboundFromConversationSnapshots(
      [
        {
          id: "conversation-1",
          customerName: "Customer",
          latestMessage: { id: "message-old", direction: "INBOUND", body: "Hi" },
        },
      ],
      [
        {
          id: "conversation-1",
          customerName: "Customer",
          latestMessage: { id: "message-new", direction: "INBOUND", body: "Sticker" },
        },
      ],
      null,
      () => undefined
    );

    expect(notificationMock).toHaveBeenCalledWith(
      "Customer",
      expect.objectContaining({ body: "Sticker", tag: "message-new" })
    );
  });
});
