"use client";

import { BookOpen, ChartNoAxesColumn, ClipboardCheck, Inbox, Settings, Megaphone } from "lucide-react";
import Link from "next/link";
import { UserMenu } from "./user-menu";
import { LanguageProvider, useLanguage } from "../lib/language-context";
import { useAuthSession } from "../lib/use-auth-session";
import { useProactiveSessionRefresh } from "../lib/use-proactive-session-refresh";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <LanguageProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </LanguageProvider>
  );
}

function AppLayoutContent({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, setLocale } = useLanguage();
  const { user, isLoading: isAuthLoading } = useAuthSession();
  useProactiveSessionRefresh();
  const role = user?.role ?? null;

  const navItems = [
    { label: locale === "th" ? "กล่องข้อความ" : "Inbox", icon: Inbox, disabled: false, href: "/app/inbox", roles: ["OWNER", "ADMIN", "AGENT", "QC"] },
    { label: locale === "th" ? "บรอดแคสต์" : "Broadcast", icon: Megaphone, disabled: false, href: "/app/broadcast", roles: ["OWNER", "ADMIN"] },
    { label: locale === "th" ? "รายงาน" : "Reports", icon: ChartNoAxesColumn, disabled: false, href: "/app/reports", roles: ["OWNER", "ADMIN", "QC", "VIEWER"] },
    { label: locale === "th" ? "QA" : "QA", icon: ClipboardCheck, disabled: false, href: "/app/qa", roles: ["OWNER", "ADMIN", "QC"] },
    { label: locale === "th" ? "คลังความรู้" : "Knowledge", icon: BookOpen, disabled: false, href: "/app/settings?tab=knowledge&sub=documents", roles: ["OWNER", "ADMIN", "AGENT", "QC"] },
    { label: locale === "th" ? "ตั้งค่า" : "Settings", icon: Settings, disabled: false, href: "/app/settings", roles: ["OWNER", "ADMIN", "AGENT", "QC"] }
  ];

  const filteredNavItems = role ? navItems.filter((item) => item.roles.includes(role)) : [];

  return (
    <main className="flex h-dvh overflow-hidden bg-[#F7F7FA] text-foreground">
      <nav aria-label="Primary" className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-border bg-white py-3">
        {isAuthLoading
          ? Array.from({ length: 5 }, (_, index) => (
              <span
                key={`nav-skeleton-${index}`}
                aria-hidden="true"
                className="h-10 w-10 animate-pulse rounded-md bg-secondary"
              />
            ))
          : null}
        {!isAuthLoading &&
          filteredNavItems.map((item) => {
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
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white px-6">
          <div>
            <p className="font-heading text-sm font-medium">Chat-Wai</p>
            <p className="text-xs text-muted-foreground">By Florentino.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLocale(locale === "th" ? "en" : "th")}
              className="flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-secondary transition-colors"
            >
              🌐 {locale === "th" ? "EN" : "TH"}
            </button>
            <UserMenu />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </section>
    </main>
  );
}
