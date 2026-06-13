import { BookOpen, ChartNoAxesColumn, Inbox, LogOut, Settings, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@omnichat/ui";

const navItems = [
  { label: "Inbox", icon: Inbox, disabled: false, href: "/app/inbox" },
  { label: "Customers", icon: Users, disabled: true },
  { label: "Reports", icon: ChartNoAxesColumn, disabled: true },
  { label: "Knowledge", icon: BookOpen, disabled: true },
  { label: "Settings", icon: Settings, disabled: false, href: "/app/settings" }
];

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
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
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
          <div>
            <p className="font-heading text-sm font-medium">OmniChat</p>
            <p className="text-xs text-muted-foreground">Stage 1 foundation</p>
          </div>
          {/* User menu placeholder */}
          <div className="group relative">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-sm text-foreground shadow-sm hover:bg-secondary transition-colors"
              aria-label="User menu"
              id="user-menu-btn"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                A
              </span>
              <span className="hidden sm:block text-xs font-medium">Admin</span>
              <Badge variant="muted" className="hidden sm:inline-flex text-[10px] py-0 px-1.5">
                ADMIN
              </Badge>
            </button>
            {/* Dropdown */}
            <div className="absolute right-0 top-full z-50 mt-1 hidden w-52 rounded-lg border border-border bg-white shadow-lg group-focus-within:block">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Admin User</p>
                <p className="text-xs text-muted-foreground">admin@omnichat.io</p>
              </div>
              <div className="py-1">
                <Link
                  href="/app/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-secondary"
                >
                  <Settings size={14} aria-hidden="true" />
                  Settings
                </Link>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-danger/10"
                  onClick={() => {
                    // TODO: wire real logout when auth is ready
                    window.location.href = "/login";
                  }}
                >
                  <LogOut size={14} aria-hidden="true" />
                  ออกจากระบบ
                </button>
              </div>
            </div>
          </div>
        </header>
        {/* Page content — no padding, pages manage their own layout */}
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </section>
    </main>
  );
}
