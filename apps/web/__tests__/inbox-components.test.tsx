import { fireEvent, render, screen, within } from "@testing-library/react";
import { ChatInput, MessageBubble } from "../components/inbox/ChatWindow";
import { ConversationCard } from "../components/inbox/ConversationList";
import { CustomerPanel } from "../components/inbox/CustomerPanel";
import { BottomNav } from "../components/inbox/mobile/BottomNav";
import { STATUS_CONFIG } from "../components/inbox/status-config";

describe("Inbox components", () => {
  it("exposes the Stage 2 status helper values", () => {
    expect(STATUS_CONFIG.OPEN.text).toBe("เปิดอยู่");
    expect(STATUS_CONFIG.PENDING.dot).toBe("#E49A27");
    expect(STATUS_CONFIG.RESOLVED.avatarText).toBe("#71717A");
  });

  it("renders conversation card status, channel, and unread badge", () => {
    const onSelect = jest.fn();

    render(
      <ConversationCard
        id="conversation-1"
        customerName="Somchai"
        customerInitial="S"
        preview="สนใจสินค้า"
        time="10:20"
        channelTag="JB-SV"
        status="PENDING"
        unreadCount={2}
        isActive
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open conversation Somchai" }));
    expect(onSelect).toHaveBeenCalledWith("conversation-1");
    expect(screen.getByText("JB-SV")).toBeInTheDocument();
    expect(screen.getByText("รอแอดมิน")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders message variants and sends composer text", () => {
    const onSend = jest.fn();
    const onChange = jest.fn();

    render(
      <>
        <MessageBubble variant="inbound" body="hello" time="10:20" />
        <MessageBubble variant="outbound" body="reply" time="10:21" />
        <MessageBubble variant="note" body="private note" time="10:22" />
        <MessageBubble variant="system" body="ปิดแชทแล้ว · 05:49" />
        <ChatInput
          value="ตอบกลับ"
          channelLabel="JB-SV"
          onChange={onChange}
          onSend={onSend}
        />
      </>
    );

    expect(screen.getByText("โน้ตทีม")).toBeInTheDocument();
    expect(screen.getByText("ปิดแชทแล้ว · 05:49")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(onSend).toHaveBeenCalled();
  });

  it("contains very long message text inside the bubble", () => {
    const longText = "x".repeat(240);

    render(<MessageBubble variant="inbound" body={longText} time="10:20" />);

    const messageText = screen.getByText(longText);
    expect(messageText).toHaveClass("break-words");
    expect(messageText.closest('[data-testid="message-bubble-frame"]')).toHaveClass("max-w-full");
  });

  it("renders customer panel and mobile bottom navigation", () => {
    const onChange = jest.fn();

    render(
      <>
        <CustomerPanel customerName="Somchai" customerInitial="S" lineLabel="JB-SV" />
        <BottomNav activeTab="chats" onChange={onChange} />
      </>
    );

    expect(screen.getAllByText("Somchai").length).toBeGreaterThan(0);
    expect(screen.getByText("LINE OA · JB-SV")).toBeInTheDocument();
    const mobileNav = screen.getByRole("navigation", { name: "Mobile inbox navigation" });
    fireEvent.click(within(mobileNav).getByRole("button", { name: /ลูกค้า/ }));
    expect(onChange).toHaveBeenCalledWith("customers");
  });
});
