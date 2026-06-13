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
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/inbox/conversations", {
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
});
