import { fireEvent, render, screen, within } from "@testing-library/react";
import { ChatInput, ChatWindow, MessageBubble } from "../components/inbox/ChatWindow";
import { ConversationCard } from "../components/inbox/ConversationList";
import { CustomerPanel } from "../components/inbox/CustomerPanel";
import { BottomNav } from "../components/inbox/mobile/BottomNav";
import { STATUS_CONFIG } from "../components/inbox/status-config";
import { LanguageProvider } from "../app/lib/language-context";

jest.mock("../app/lib/language-context", () => {
  const actual = jest.requireActual("../app/lib/language-context");
  return {
    ...actual,
    useLanguage: () => ({ locale: "th", setLocale: () => {} })
  };
});

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

  it("keeps the composer below a flex-growing message scroll region", () => {
    render(
      <div className="flex h-[640px] min-h-0 flex-col overflow-hidden">
        <ChatWindow
          channelLabel="Main LINE"
          composer={<div data-testid="composer-slot">Composer</div>}
          customerInitial="S"
          customerName="Somchai"
          messages={[{ id: "m1", variant: "inbound", body: "hello" }]}
          onQuickReply={() => {}}
          onUpdatePriority={() => {}}
          onUpdateStatus={() => {}}
          priority="NORMAL"
          status="OPEN"
          toggleStatusMenu={() => {}}
        />
      </div>
    );

    const chatWindow = screen.getByTestId("chat-window");
    const messagesScroll = screen.getByTestId("chat-messages-scroll");
    const composer = screen.getByTestId("chat-composer");

    expect(chatWindow).toHaveClass("h-full");
    expect(chatWindow).toHaveClass("min-h-0");
    expect(chatWindow).toHaveClass("overflow-hidden");
    expect(messagesScroll).toHaveClass("flex-1");
    expect(messagesScroll).toHaveClass("min-h-0");
    expect(messagesScroll).toHaveClass("overflow-y-auto");
    expect(messagesScroll).toHaveClass("flex");
    expect(messagesScroll).toHaveClass("flex-col");
    expect(screen.getByTestId("chat-messages-stack")).toHaveClass("mt-auto");
    expect(composer).toHaveClass("shrink-0");
    expect(
      messagesScroll.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
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
      <LanguageProvider>
        <CustomerPanel customerName="Somchai" customerInitial="S" lineLabel="JB-SV" />
        <BottomNav activeTab="chats" onChange={onChange} />
      </LanguageProvider>
    );

    expect(screen.getAllByText("Somchai").length).toBeGreaterThan(0);
    expect(screen.getByText("LINE OA · JB-SV")).toBeInTheDocument();
    const mobileNav = screen.getByRole("navigation", { name: "Mobile inbox navigation" });
    fireEvent.click(within(mobileNav).getByRole("button", { name: /ลูกค้า/ }));
    expect(onChange).toHaveBeenCalledWith("customers");
  });
});
