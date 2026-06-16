import { MessageCircle, MessagesSquare, Users } from "lucide-react";

export type MobileInboxTab = "chats" | "thread" | "customers";

interface BottomNavProps {
  activeTab: MobileInboxTab;
  onChange: (tab: MobileInboxTab) => void;
}

const tabs = [
  { id: "chats", label: "แชท", icon: MessageCircle },
  { id: "thread", label: "ข้อความ", icon: MessagesSquare },
  { id: "customers", label: "ลูกค้า", icon: Users }
] as const;

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav aria-label="Mobile inbox navigation" className="grid h-[54px] grid-cols-3 border-t border-border bg-white md:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            className={[
              "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              active ? "text-primary" : "text-muted-foreground"
            ].join(" ")}
            onClick={() => onChange(tab.id)}
            type="button"
          >
            <Icon size={18} aria-hidden="true" />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
