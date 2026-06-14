import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import InboxPage from "../app/app/inbox/page";

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

    render(<InboxPage />);

    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
    expect(await screen.findAllByText("Somchai LINE")).toHaveLength(2);
    expect(screen.getByText("สวัสดีครับ")).toBeInTheDocument();
    expect(screen.queryByText("Messages from LINE will render here after API binding.")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/inbox/conversations?limit=10&offset=0", {
      headers: { Authorization: "Bearer access-token" }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/inbox/conversations/conversation-1/messages", {
      headers: { Authorization: "Bearer access-token" }
    });
    expect(screen.getByText("Customer context")).toBeInTheDocument();
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

    render(<InboxPage />);

    expect(await screen.findByText("No LINE conversations yet.")).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect((await screen.findAllByText("U456")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("new LINE message")).toHaveLength(2);
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

    render(<InboxPage />);

    expect(await screen.findByText("first message")).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(await screen.findByText("second live message")).toBeInTheDocument();
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

    render(<InboxPage />);

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

    render(<InboxPage />);

    expect(await screen.findByText("ดีๆ")).toBeInTheDocument();
    expect(screen.getAllByText("Line OA 2")[0]).toHaveStyle({ backgroundColor: "#16a34a" });
    expect(screen.getAllByText("Line OA 1")[0]).toHaveStyle({ backgroundColor: "#4f46e5" });
    expect(screen.getAllByText("F").length).toBeGreaterThanOrEqual(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
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

    render(<InboxPage />);

    const layout = await screen.findByTestId("inbox-layout");
    expect(layout).toHaveClass("h-[calc(100vh-12rem)]");
    expect(layout).toHaveClass("lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(220px,300px)]");
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

    render(<InboxPage />);

    expect((await screen.findAllByText("Customer A")).length).toBeGreaterThan(0);
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
        json: async () => ({ success: true, data: [] })
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

    render(<InboxPage />);

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

    render(<InboxPage />);

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

    render(<InboxPage />);
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
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] })
      });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(<InboxPage />);

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

    fireEvent.change(screen.getByRole("textbox", { name: "Reply image URL" }), {
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
});
