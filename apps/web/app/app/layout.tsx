import { BookOpen, ChartNoAxesColumn, Inbox, Settings, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@omnichat/ui";

const navItems = [
  { label: "Inbox", icon: Inbox, disabled: false, href: "/app/inbox" },
  { label: "Customers", icon: Users, disabled: true },
  { label: "Reports", icon: ChartNoAxesColumn, disabled: true },
  { label: "Knowledge", icon: BookOpen, disabled: true },
  { label: "Settings", icon: Settings, disabled: false }
];

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <nav aria-label="Primary" className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-border bg-white py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const className =
            "flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";
          if (item.href) {
            return (
              <Link
                key={item.label}
                aria-label={item.label}
                className={className}
                href={item.href}
                title={item.label}
              >
                <Icon aria-hidden="true" size={18} />
              </Link>
            );
          }
          return (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              disabled={item.disabled}
              className={className}
              title={item.label}
            >
              <Icon aria-hidden="true" size={18} />
            </button>
          );
        })}
      </nav>
      <section className="min-w-0 flex-1">
        <header className="flex h-14 items-center justify-between border-b border-border px-6">
          <div>
            <p className="font-heading text-sm font-medium">OmniChat</p>
            <p className="text-xs text-muted-foreground">Stage 1 foundation</p>
          </div>
          <Badge variant="muted">Settings</Badge>
        </header>
        <div className="p-6">{children}</div>
      </section>
    </main>
  );
}
