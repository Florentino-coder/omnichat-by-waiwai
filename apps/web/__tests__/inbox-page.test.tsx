import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import InboxPage from "../app/app/inbox/page";

describe("InboxPage", () => {
  it("renders the Stage 3 inbox shell with conversation, thread, and context panels", () => {
    render(<InboxPage />);

    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(screen.getByText("Message thread")).toBeInTheDocument();
    expect(screen.getByText("Customer context")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply text" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send reply" })).toBeDisabled();
  });

  it("posts reply text through the existing LINE conversation reply route", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock
    });

    render(<InboxPage />);

    fireEvent.change(screen.getByRole("textbox", { name: "Reply text" }), {
      target: { value: "Hello from inbox" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/line/conversations/1/reply", {
        body: JSON.stringify({ text: "Hello from inbox" }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
    });
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });
});
