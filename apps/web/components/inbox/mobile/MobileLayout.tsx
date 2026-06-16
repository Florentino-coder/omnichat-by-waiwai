import { type ReactNode, useState } from "react";
import { BottomNav, type MobileInboxTab } from "./BottomNav";

interface MobileLayoutProps {
  list: ReactNode;
  chat: ReactNode;
  customer: ReactNode;
}

export function MobileLayout({ list, chat, customer }: MobileLayoutProps) {
  const [activeTab, setActiveTab] = useState<MobileInboxTab>("chats");
  return (
    <section className="flex h-screen flex-col md:hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "chats" ? list : null}
        {activeTab === "thread" ? chat : null}
        {activeTab === "customers" ? customer : null}
      </div>
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </section>
  );
}

export { BottomNav };
export type { MobileInboxTab };
