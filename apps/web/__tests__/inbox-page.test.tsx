import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import InboxPage from "../app/app/inbox/page";
import InboxClient from "../app/app/inbox/inbox-client";

jest.mock("../app/lib/language-context", () => ({
  useLanguage: () => ({ locale: "th", setLocale: () => {} }),
  LanguageProvider: ({ children }: any) => <>{children}</>
}));

jest.mock("../app/lib/api-client", () => {
  const original = jest.requireActual("../app/lib/api-client");
  return {
    ...original,
    apiFetch: jest.fn().mockImplementation(async (path, options) => {
      const fetchMock = globalThis.fetch as any;
      if (jest.isMockFunction(fetchMock)) {
        const impl = fetchMock.getMockImplementation();
        if (impl) {
          return original.apiFetch(path, options);
        }
      }
      if (
        path.includes("/saved-replies") ||
        path.includes("/tags") ||
        path.includes("/notes") ||
        path.includes("/members")
      ) {
        return [];
      }
      return original.apiFetch(path, options);
    })
  };
});

function createSseReader(chunks: string[]) {
  let index = 0;
  return {
    read: jest.fn(async () => {
      if (index >= chunks.length) {
        return { done: true, value: undefined };
      }
      const value = Uint8Array.from(chunks[index].split("").map((char) => char.charCodeAt(0)));
      index += 1;
      return { done: false, value };
    }),
    releaseLock: jest.fn()
  };
}

describe("InboxPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("omnichat.accessToken", "access-token");
  });

  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
    jest.useRealTimers();
  });

  it("loads tenant conversations and messages from the inbox API", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "conversation-1",
              externalThreadId: "U123",
              displayName: "Somchai LINE",
              status: "OPEN",
              lastMessageAt: "2026-06-14T01:00:00.000Z",
              lineChannel: {
                id: "line-channel-1",
                name: "Main LINE",
                badgeColor: "#0ea5e9",
                lineChannelId: "1234567890"
              },
              messages: [
                {
                  id: "message-preview-1",
                  direction: "INBOUND",
                  text: "สวัสดีครับ",
                  createdAt: "2026-06-14T01:00:00.000Z"
                }
              ]
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "message-1",
              direction: "INBOUND",
              text: "สวัสดีครับ",
              createdAt: "2026-06-14T01:00:00.000Z",
              rawPayload: {
                source: { type: "user", userId: "U123" },
                message: { id: "line-message-1", type: "text" },
                timestamp: 1781398800000,
                lineProfile: {
                  displayName: "Somchai LINE",
                  pictureUrl: "https://profile.line-scdn.net/customer.png",
                  statusMessage: "Ready",
                  language: "th"
                }
              }
            }
          ]
        })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());

    expect(screen.getByRole("heading", { name: "กล่องข้อความ" })).toBeInTheDocument();
    
    // Select the conversation
    const openBtn = await screen.findByRole("button", { name: "Open conversation Somchai LINE" });
    fireEvent.click(openBtn);

    expect((await screen.findAllByText("Somchai LINE")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("สวัสดีครับ").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Messages from LINE will render here after API binding.")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/inbox/conversations?limit=10&offset=0", {
      headers: { Authorization: "Bearer access-token" }
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/inbox/conversations/conversation-1/messages", {
      headers: { Authorization: "Bearer access-token" }
    });
    expect(screen.getByText("ข้อมูลลูกค้า")).toBeInTheDocument();
    expect(screen.getAllByText("Main LINE").length).toBeGreaterThan(0);
    expect(screen.getByText("1234567890")).toBeInTheDocument();
    expect(screen.getByText("U123")).toBeInTheDocument();
    expect(await screen.findByText("line-message-1")).toBeInTheDocument();
    expect(await screen.findByText("Ready")).toBeInTheDocument();
    expect(await screen.findByText("th")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply text" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send reply" })).toBeDisabled();
  });

  it("refreshes the inbox so newly received LINE conversations appear", async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "conversation-2",
              externalThreadId: "U456",
              status: "OPEN",
              lastMessageAt: "2026-06-14T01:05:00.000Z",
              lineChannel: {
                id: "line-channel-1",
                name: "Main LINE",
                badgeColor: "#0ea5e9",
                lineChannelId: "1234567890"
              },
              messages: [
                {
                  id: "message-preview-2",
                  direction: "INBOUND",
                  text: "new LINE message",
                  createdAt: "2026-06-14T01:05:00.000Z"
                }
              ]
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "message-2",
              direction: "INBOUND",
              text: "new LINE message",
              createdAt: "2026-06-14T01:05:00.000Z"
            }
          ]
        })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());

    expect(await screen.findByText("ยังไม่มีแชท LINE")).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(60000);
    });

    const openBtn = await screen.findByRole("button", { name: "Open conversation U456" });
    fireEvent.click(openBtn);

    expect((await screen.findAllByText("U456")).length).toBeGreaterThanOrEqual(2);
    await waitFor(() => {
      expect(screen.getAllByText("new LINE message")).toHaveLength(2);
    });
  });

  it("refreshes the selected message thread without a browser reload", async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "conversation-1",
              externalThreadId: "U123",
              displayName: "Somchai LINE",
              status: "OPEN",
              lastMessageAt: "2026-06-14T01:00:00.000Z",
              lineChannel: {
                id: "line-channel-1",
                name: "Main LINE",
                badgeColor: "#0ea5e9",
                lineChannelId: "1234567890"
              },
              messages: []
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "message-1",
              direction: "INBOUND",
              text: "first message",
              createdAt: "2026-06-14T01:00:00.000Z"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "message-1",
              direction: "INBOUND",
              text: "first message",
              createdAt: "2026-06-14T01:00:00.000Z"
            },
            {
              id: "message-2",
              direction: "INBOUND",
              text: "second live message",
              createdAt: "2026-06-14T01:00:02.000Z"
            }
          ]
        })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());

    const openBtn = await screen.findByRole("button", { name: "Open conversation Somchai LINE" });
    fireEvent.click(openBtn);

    expect(await screen.findByText("first message")).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(await screen.findByText("second live message")).toBeInTheDocument();
  });

  it("marks an unread LINE conversation as read when opened", async () => {
    const fetchMock = jest.fn((url) => {
      if (url.includes("/api/v1/inbox/conversations?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: "conversation-unread",
                externalThreadId: "U-unread",
                displayName: "Unread Customer",
                status: "OPEN",
                unreadInboundMessageCount: 1,
                lineChannel: {
                  id: "line-channel-1",
                  name: "Main LINE",
                  badgeColor: "#0ea5e9",
                  lineChannelId: "1234567890"
                },
                messages: [
                  {
                    id: "message-preview-unread",
                    direction: "INBOUND",
                    text: "needs read receipt",
                    createdAt: "2026-06-14T01:00:00.000Z"
                  }
                ]
              }
            ]
          })
        });
      }
      if (url.includes("/messages")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: "message-unread",
                direction: "INBOUND",
                text: "needs read receipt",
                createdAt: "2026-06-14T01:00:00.000Z"
              }
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());
    fireEvent.click(await screen.findByRole("button", { name: "Open conversation Unread Customer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/inbox/conversations/conversation-unread/mark-as-read", {
        headers: { Authorization: "Bearer access-token" },
        method: "PATCH"
      });
    });
  });

  it("opens the tenant SSE stream and refreshes the active thread on realtime events", async () => {
    window.localStorage.setItem("omnichat.user", JSON.stringify({ tenantId: "tenant-1", workspaceId: "workspace-1" }));
    const sseReader = createSseReader([
      'event: message.created\ndata: {"conversationId":"conversation-1"}\n\n'
    ]);
    const fetchMock = jest.fn((url) => {
      if (url.includes("/api/v1/sse/tenant/tenant-1")) {
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => sseReader
          }
        });
      }
      if (url.includes("/api/v1/inbox/conversations?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: "conversation-1",
                externalThreadId: "U123",
                displayName: "Realtime Customer",
                status: "OPEN",
                lineChannel: {
                  id: "line-channel-1",
                  name: "Main LINE",
                  badgeColor: "#0ea5e9",
                  lineChannelId: "1234567890"
                },
                messages: []
              }
            ]
          })
        });
      }
      if (url.includes("/messages")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: "message-live",
                direction: "INBOUND",
                text: "live via sse",
                createdAt: "2026-06-14T01:00:02.000Z"
              }
            ]
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());
    fireEvent.click(await screen.findByRole("button", { name: "Open conversation Realtime Customer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/sse/tenant/tenant-1", {
        headers: { Authorization: "Bearer access-token" },
        signal: expect.any(AbortSignal)
      });
    });
    expect(await screen.findByText("live via sse")).toBeInTheDocument();
  });

  it("ignores stale message responses after switching conversations", async () => {
    let resolveFirstMessages: (value: { success: true; data: unknown[] }) => void = () => {};
    const firstMessages = new Promise<{ success: true; data: unknown[] }>((resolve) => {
      resolveFirstMessages = resolve;
    });
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "conversation-a",
              externalThreadId: "UA",
              displayName: "Customer A",
              status: "OPEN",
              lineChannel: {
                id: "line-channel-1",
                name: "Main LINE",
                badgeColor: "#0ea5e9",
                lineChannelId: "1234567890"
              },
              messages: []
            },
            {
              id: "conversation-b",
              externalThreadId: "UB",
              displayName: "Customer B",
              status: "OPEN",
              lineChannel: {
                id: "line-channel-1",
                name: "Main LINE",
                badgeColor: "#0ea5e9",
                lineChannelId: "1234567890"
              },
              messages: []
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => firstMessages
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "message-b",
              direction: "INBOUND",
              text: "fresh B message",
              createdAt: "2026-06-14T01:00:02.000Z"
            }
          ]
        })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());

    const customerA = await screen.findByText("Customer A");
    fireEvent.click(customerA.closest("button") as HTMLButtonElement);

    const customerB = await screen.findByText("Customer B");
    fireEvent.click(customerB.closest("button") as HTMLButtonElement);

    expect(await screen.findByText("fresh B message")).toBeInTheDocument();

    await act(async () => {
      resolveFirstMessages({
        success: true,
        data: [
          {
            id: "message-a",
            direction: "INBOUND",
            text: "stale A message",
            createdAt: "2026-06-14T01:00:01.000Z"
          }
        ]
      });
    });

    expect(screen.queryByText("stale A message")).not.toBeInTheDocument();
  });

  it("renders sticker messages and applies the LINE OA badge color", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "conversation-2",
              externalThreadId: "U456",
              displayName: "Customer Two",
              status: "OPEN",
              lastMessageAt: "2026-06-14T02:30:00.000Z",
              lineChannel: {
                id: "line-channel-2",
                name: "Line OA 2",
                badgeColor: "#16a34a",
                lineChannelId: "1656471223"
              },
              messages: [
                {
                  id: "message-preview-sticker",
                  direction: "INBOUND",
                  type: "STICKER",
                  text: null,
                  rawPayload: {
                    message: {
                      id: "sticker-msg-1",
                      type: "sticker",
                      packageId: "11538",
                      stickerId: "51626494"
                    }
                  },
                  createdAt: "2026-06-14T02:30:00.000Z"
                }
              ]
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "message-sticker",
              direction: "INBOUND",
              type: "STICKER",
              text: null,
              createdAt: "2026-06-14T02:30:00.000Z",
              rawPayload: {
                source: { type: "user", userId: "U456" },
                message: {
                  id: "sticker-msg-1",
                  type: "sticker",
                  packageId: "11538",
                  stickerId: "51626494",
                  stickerResourceType: "STATIC"
                }
              }
            }
          ]
        })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());

    const openBtn = await screen.findByRole("button", { name: "Open conversation Customer Two" });
    fireEvent.click(openBtn);

    expect(await screen.findByText("Sticker 51626494")).toBeInTheDocument();
    expect(await screen.findByText("Package 11538")).toBeInTheDocument();
    expect(screen.getAllByText("Line OA 2")[0]).toHaveStyle({
      backgroundColor: "#16a34a"
    });
  });

  it("keeps the same LINE customer visible as separate rows for each OA channel", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "conversation-oa-2",
              externalThreadId: "U-same",
              displayName: "F",
              status: "OPEN",
              lastMessageAt: "2026-06-14T03:00:00.000Z",
              lineChannel: {
                id: "line-channel-2",
                name: "Line OA 2",
                badgeColor: "#16a34a",
                lineChannelId: "1656471223"
              },
              messages: [
                {
                  id: "message-preview-oa-2",
                  direction: "INBOUND",
                  type: "TEXT",
                  text: "ดีๆ",
                  createdAt: "2026-06-14T03:00:00.000Z"
                }
              ]
            },
            {
              id: "conversation-oa-1",
              externalThreadId: "U-same",
              displayName: "F",
              status: "OPEN",
              lastMessageAt: "2026-06-14T02:00:00.000Z",
              lineChannel: {
                id: "line-channel-1",
                name: "Line OA 1",
                badgeColor: "#4f46e5",
                lineChannelId: "2009897327"
              },
              messages: [
                {
                  id: "message-preview-oa-1",
                  direction: "INBOUND",
                  type: "TEXT",
                  text: "เก่า",
                  createdAt: "2026-06-14T02:00:00.000Z"
                }
              ]
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "message-oa-2",
              direction: "INBOUND",
              type: "TEXT",
              text: "ดีๆ",
              createdAt: "2026-06-14T03:00:00.000Z",
              rawPayload: {
                source: { type: "user", userId: "U-same" },
                message: { id: "line-message-oa-2", type: "text" },
                lineProfile: { displayName: "F" }
              }
            }
          ]
        })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());

    const openBtns = await screen.findAllByRole("button", { name: "Open conversation F" });
    fireEvent.click(openBtns[0]);

    expect(await screen.findByText("ดีๆ")).toBeInTheDocument();
    expect(screen.getAllByText("Line OA 2")[0]).toHaveStyle({ backgroundColor: "#16a34a" });
    expect(screen.getAllByText("Line OA 1")[0]).toHaveStyle({ backgroundColor: "#4f46e5" });
    expect(screen.getAllByText("F").length).toBeGreaterThanOrEqual(3);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/inbox/conversations/conversation-oa-2/messages",
      {
        headers: { Authorization: "Bearer access-token" }
      }
    );
  });

  it("uses a viewport-fit inbox layout instead of a fixed wide board", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());

    const layout = await screen.findByTestId("inbox-layout");
    expect(layout).toHaveClass("h-full");
    expect(layout).toHaveClass("lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)_minmax(18rem,21rem)]");
    expect(screen.getByTestId("conversation-list-panel")).not.toHaveClass("hidden");
    expect(screen.getByTestId("conversation-list-panel")).toHaveClass("md:flex");
    expect(screen.getByTestId("customer-context-panel")).toHaveClass("hidden");
    expect(screen.getByTestId("customer-context-panel")).toHaveClass("xl:flex");
    expect(screen.getByRole("navigation", { name: "Mobile inbox navigation" })).toBeInTheDocument();
  });

  it("shows selected LINE channel in the premium composer toolbar", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "conversation-1",
              externalThreadId: "U123",
              displayName: "Customer LINE",
              status: "OPEN",
              lineChannel: {
                id: "line-channel-1",
                name: "Main LINE",
                badgeColor: "#0ea5e9",
                lineChannelId: "1234567890"
              },
              messages: []
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());

    const openBtn = await screen.findByRole("button", { name: "Open conversation Customer LINE" });
    fireEvent.click(openBtn);

    expect(await screen.findByText("LINE OA: Main LINE")).toBeInTheDocument();
  });

  it("changes a conversation to in progress, shows a running timer, and saves the alert threshold", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "conversation-1",
              externalThreadId: "U123",
              displayName: "Customer A",
              status: "OPEN",
              inProgressStartedAt: null,
              lastMessageAt: "2026-06-14T01:00:00.000Z",
              lineChannel: {
                id: "line-channel-1",
                name: "Line OA 1",
                badgeColor: "#4f46e5",
                lineChannelId: "1234567890"
              },
              messages: []
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "conversation-1",
            status: "IN_PROGRESS",
            inProgressStartedAt: "2026-06-14T01:00:00.000Z"
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { inProgressAlertMinutes: 5 }
        })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());

    expect((await screen.findAllByText("Customer A")).length).toBeGreaterThan(0);
    
    const openBtn = await screen.findByRole("button", { name: "Open conversation Customer A" });
    fireEvent.click(openBtn);

    fireEvent.click(screen.getByRole("button", { name: "Change conversation status" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "กำลังดำเนินการ" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/inbox/conversations/conversation-1/status",
        {
          body: JSON.stringify({ status: "IN_PROGRESS" }),
          headers: {
            Authorization: "Bearer access-token",
            "Content-Type": "application/json"
          },
          method: "PATCH"
        }
      );
    });
    expect(await screen.findAllByText(/กำลังดำเนินการ/)).not.toHaveLength(0);

    fireEvent.change(screen.getByLabelText("In-progress alert minutes"), {
      target: { value: "5" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save alert minutes" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/inbox/settings", {
        body: JSON.stringify({ inProgressAlertMinutes: 5 }),
        headers: {
          Authorization: "Bearer access-token",
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });
    });
  });

  it("loads more conversations in pages of 10", async () => {
    const firstPage = Array.from({ length: 10 }, (_, index) => ({
      id: `conversation-${index + 1}`,
      externalThreadId: `U${index + 1}`,
      displayName: `Customer ${index + 1}`,
      status: "OPEN",
      lineChannel: {
        id: "line-channel-1",
        name: "Line OA 1",
        badgeColor: "#4f46e5",
        lineChannelId: "1234567890"
      },
      messages: []
    }));
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: firstPage })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "conversation-11",
              externalThreadId: "U11",
              displayName: "Customer 11",
              status: "OPEN",
              lineChannel: {
                id: "line-channel-1",
                name: "Line OA 1",
                badgeColor: "#4f46e5",
                lineChannelId: "1234567890"
              },
              messages: []
            }
          ]
        })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());

    expect(await screen.findByText("Customer 10")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load older conversations" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/inbox/conversations?limit=10&offset=10", {
        headers: { Authorization: "Bearer access-token" }
      });
    });
    expect(await screen.findByText("Customer 11")).toBeInTheDocument();
  });

  it("renames the selected customer from the inbox context panel", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "conversation-1",
              externalThreadId: "U123",
              displayName: "F",
              status: "OPEN",
              lastMessageAt: "2026-06-14T01:00:00.000Z",
              lineChannel: {
                id: "line-channel-1",
                name: "Main LINE",
                badgeColor: "#0ea5e9",
                lineChannelId: "1234567890"
              },
              messages: []
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "conversation-1",
            nickname: "Customer F"
          }
        })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());

    const openBtn = await screen.findByRole("button", { name: "Open conversation F" });
    fireEvent.click(openBtn);

    expect((await screen.findAllByText("F")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Edit customer name" }));
    fireEvent.change(screen.getByLabelText("Customer nickname"), {
      target: { value: "Customer F" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save customer name" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/inbox/conversations/conversation-1/customer-name",
        {
          body: JSON.stringify({ nickname: "Customer F" }),
          headers: {
            Authorization: "Bearer access-token",
            "Content-Type": "application/json"
          },
          method: "PATCH"
        }
      );
    });
    expect((await screen.findAllByText("Customer F")).length).toBeGreaterThan(0);
  });

  it("shows inbox operation controls for assignment, priority, tags, notes, and saved replies", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "conversation-1",
              externalThreadId: "U123",
              displayName: "Customer Ops",
              status: "OPEN",
              priority: "NORMAL",
              assignedToMemberId: null,
              lineChannel: {
                id: "line-channel-1",
                name: "Main LINE",
                badgeColor: "#0ea5e9",
                lineChannelId: "1234567890"
              },
              messages: []
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());
    fireEvent.click(await screen.findByRole("button", { name: "Open conversation Customer Ops" }));

    expect((await screen.findAllByText("Customer Ops")).length).toBeGreaterThan(0);
    expect(screen.getByRole("combobox", { name: "มอบหมาย" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Priority" })).toBeInTheDocument();
    expect(screen.getByText("แท็ก")).toBeInTheDocument();
    expect(screen.getByText("โน้ตภายใน")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Insert saved reply" })).toBeInTheDocument();
  });

  it("loads usable inbox operation data for tags, notes, and saved replies", async () => {
    const fetchMock = jest.fn((url) => {
      if (url.includes("/api/v1/inbox/conversations?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: "conversation-1",
                externalThreadId: "U123",
                displayName: "Customer Ops",
                status: "OPEN",
                priority: "NORMAL",
                assignedToMemberId: null,
                tagLinks: [],
                lineChannel: {
                  id: "line-channel-1",
                  name: "Main LINE",
                  badgeColor: "#0ea5e9",
                  lineChannelId: "1234567890"
                },
                messages: []
              }
            ]
          })
        });
      }
      if (url.includes("/messages")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
      }
      if (url.includes("/tags")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [{ id: "tag-vip", name: "VIP", color: "#f97316" }]
          })
        });
      }
      if (url.includes("/saved-replies")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: "reply-1",
                lineChannelId: "line-channel-1",
                title: "Greeting",
                body: "สวัสดีค่ะ ทีมงานกำลังตรวจสอบให้ค่ะ",
                isActive: true
              }
            ]
          })
        });
      }
      if (url.includes("/notes")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: "note-1",
                body: "ลูกค้ารอใบเสนอราคา",
                createdAt: "2026-06-14T01:00:00.000Z",
                authorMemberId: "member-1"
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: { id: "link-1" } })
      });
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());
    fireEvent.click(await screen.findByRole("button", { name: "Open conversation Customer Ops" }));

    expect((await screen.findAllByText("Customer Ops")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("button", { name: "Add tag VIP" })).toBeInTheDocument();
    expect(await screen.findByText("Main LINE : Quick Reply Greeting")).toBeInTheDocument();
    expect((await screen.findAllByText("ลูกค้ารอใบเสนอราคา")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Add tag VIP" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/inbox/conversations/conversation-1/tags/tag-vip",
        {
          headers: { Authorization: "Bearer access-token" },
          method: "POST"
        }
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Main LINE Quick Reply Greeting" }));
    expect(screen.getByRole("textbox", { name: "Reply text" })).toHaveValue(
      "สวัสดีค่ะ ทีมงานกำลังตรวจสอบให้ค่ะ"
    );
  });

  it("loads LINE OA quick replies, inserts with plus, and auto-enters when enabled", async () => {
    let messagesCallCount = 0;
    const fetchMock = jest.fn((url) => {
      if (url.includes("/api/v1/inbox/conversations?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: "conversation-1",
                externalThreadId: "U123",
                displayName: "Customer QR",
                status: "OPEN",
                tagLinks: [],
                lineChannel: {
                  id: "line-channel-1",
                  name: "Line OA 1",
                  badgeColor: "#0ea5e9",
                  lineChannelId: "1234567890"
                },
                messages: []
              }
            ]
          })
        });
      }
      if (url.includes("/messages")) {
        messagesCallCount++;
        const messageData = messagesCallCount > 1 ? [
          {
            id: "message-2",
            direction: "OUTBOUND",
            text: "Hello from Line OA 1",
            createdAt: "2026-06-14T01:01:00.000Z"
          }
        ] : [];
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: messageData }) });
      }
      if (url.includes("/tags")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
      }
      if (url.includes("/saved-replies")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: "reply-1",
                lineChannelId: "line-channel-1",
                title: "Greeting",
                body: "Hello from Line OA 1",
                isActive: true
              }
            ]
          })
        });
      }
      if (url.includes("/notes")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: null }) });
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());
    fireEvent.click(await screen.findByRole("button", { name: "Open conversation Customer QR" }));

    expect(await screen.findByText("Line OA 1 : Quick Reply Greeting")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/inbox/saved-replies?lineChannelId=line-channel-1",
        {
          headers: { Authorization: "Bearer access-token" }
        }
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Line OA 1 Quick Reply Greeting" }));
    expect(screen.getByRole("textbox", { name: "Reply text" })).toHaveValue(
      "Hello from Line OA 1"
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/v1/line/conversations/conversation-1/reply",
      expect.anything()
    );

    fireEvent.click(screen.getByRole("switch", { name: "Quick Reply Auto Enter" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Line OA 1 Quick Reply Greeting" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/line/conversations/conversation-1/reply", {
        body: JSON.stringify({ text: "Hello from Line OA 1" }),
        headers: {
          Authorization: "Bearer access-token",
          "Content-Type": "application/json"
        },
        method: "POST"
      });
    });
  });

  it("posts reply text through the existing LINE conversation reply route with auth", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "conversation-1",
              externalThreadId: "U123",
              status: "OPEN",
              lineChannel: {
                id: "line-channel-1",
                name: "Main LINE",
                badgeColor: "#0ea5e9",
                lineChannelId: "1234567890"
              },
              messages: []
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: null
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "message-2",
              direction: "OUTBOUND",
              text: "Hello from inbox",
              createdAt: "2026-06-14T01:01:00.000Z"
            }
          ]
        })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());
    fireEvent.click(await screen.findByRole("button", { name: "Open conversation U123" }));
    expect((await screen.findAllByText("U123")).length).toBeGreaterThanOrEqual(2);

    fireEvent.change(screen.getByRole("textbox", { name: "Reply text" }), {
      target: { value: "Hello from inbox" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/line/conversations/conversation-1/reply", {
        body: JSON.stringify({ text: "Hello from inbox" }),
        headers: {
          Authorization: "Bearer access-token",
          "Content-Type": "application/json"
        },
        method: "POST"
      });
    });
  });

  it("sends a reply with Enter and sends HTTPS image URLs as LINE image replies", async () => {
    const fetchMock = jest.fn((url) => {
      if (url.includes("/api/v1/inbox/conversations?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: "conversation-1",
                externalThreadId: "U123",
                status: "OPEN",
                lineChannel: {
                  id: "line-channel-1",
                  name: "Main LINE",
                  badgeColor: "#0ea5e9",
                  lineChannelId: "1234567890"
                },
                messages: []
              }
            ]
          })
        });
      }
      if (url.includes("/messages")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
      }
      if (url.includes("/reply")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: null }) });
      }
      if (url.includes("/tags")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
      }
      if (url.includes("/saved-replies")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
      }
      if (url.includes("/notes")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: null }) });
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());
    fireEvent.click(await screen.findByRole("button", { name: "Open conversation U123" }));

    expect((await screen.findAllByText("U123")).length).toBeGreaterThanOrEqual(2);
    fireEvent.change(screen.getByRole("textbox", { name: "Reply text" }), {
      target: { value: "Enter reply" }
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Reply text" }), {
      key: "Enter"
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/line/conversations/conversation-1/reply", {
        body: JSON.stringify({ text: "Enter reply" }),
        headers: {
          Authorization: "Bearer access-token",
          "Content-Type": "application/json"
        },
        method: "POST"
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "เพิ่มรูปภาพด้วย URL" }));
    fireEvent.change(screen.getByPlaceholderText("วาง https image URL"), {
      target: { value: "https://cdn.example.com/image.png" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/line/conversations/conversation-1/reply", {
        body: JSON.stringify({ imageUrl: "https://cdn.example.com/image.png" }),
        headers: {
          Authorization: "Bearer access-token",
          "Content-Type": "application/json"
        },
        method: "POST"
      });
    });
  });

  it("keeps the image URL field behind an attachment button", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "conversation-1",
              externalThreadId: "U123",
              status: "OPEN",
              lineChannel: {
                id: "line-channel-1",
                name: "Main LINE",
                badgeColor: "#0ea5e9",
                lineChannelId: "1234567890"
              },
              messages: []
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());
    fireEvent.click(await screen.findByRole("button", { name: "Open conversation U123" }));

    expect((await screen.findAllByText("U123")).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByPlaceholderText("วาง https image URL")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "เพิ่มรูปภาพด้วย URL" }));

    expect(screen.getByPlaceholderText("วาง https image URL")).toBeInTheDocument();
  });

  it("renders server-provided initial conversations before the client refresh", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] })
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(
      <InboxClient
        initialConversations={[
          {
            id: "conversation-initial",
            externalThreadId: "U-initial",
            displayName: "Initial Customer",
            status: "OPEN",
            lineChannel: {
              id: "line-channel-1",
              name: "Initial LINE",
              badgeColor: "#4f46e5",
              lineChannelId: "1234567890"
            },
            messages: [
              {
                id: "preview-initial",
                direction: "INBOUND",
                text: "server preview",
                createdAt: "2026-06-14T01:00:00.000Z"
              }
            ]
          }
        ]}
      />
    );

    expect(screen.getAllByText("Initial Customer").length).toBeGreaterThan(0);
    expect(screen.getByText("server preview")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open conversation Initial Customer" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/inbox/conversations/conversation-initial/messages", {
        headers: { Authorization: "Bearer access-token" }
      });
    });
  });

  it("uses the Phase 2 mobile bottom nav to switch between chats and customer context", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "conversation-1",
              externalThreadId: "U123",
              displayName: "Mobile Customer",
              status: "OPEN",
              lineChannel: {
                id: "line-channel-1",
                name: "Mobile LINE",
                badgeColor: "#4f46e5",
                lineChannelId: "1234567890"
              },
              messages: []
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(await InboxPage());

    expect((await screen.findAllByText("Mobile Customer")).length).toBeGreaterThan(0);
    const nav = screen.getByRole("navigation", { name: "Mobile inbox navigation" });
    fireEvent.click(nav.querySelectorAll("button")[1]);

    expect(screen.getByTestId("mobile-customer-panel")).toBeInTheDocument();
  });
});
