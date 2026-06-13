import { render, screen } from "@testing-library/react";
import InboxPage from "../app/app/inbox/page";

describe("InboxPage", () => {
  it("renders the Stage 3 inbox shell with conversation, thread, and context panels", () => {
    render(<InboxPage />);

    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
    expect(screen.getByText("Conversations")).toBeInTheDocument();
    expect(screen.getByText("Message thread")).toBeInTheDocument();
    expect(screen.getByText("Customer context")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply text" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send reply" })).toBeDisabled();
  });
});

