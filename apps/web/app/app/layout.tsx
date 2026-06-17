"use client";

import { BookOpen, ChartNoAxesColumn, Inbox, Settings, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { UserMenu } from "./user-menu";
import { LanguageProvider, useLanguage } from "../lib/language-context";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <LanguageProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </LanguageProvider>
  );
}

function AppLayoutContent({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, setLocale } = useLanguage();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("omnichat.user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setRole(parsed.role ?? "AGENT");
      }
    } catch {
      // Ignore
    }
  }, []);

  const navItems = [
    { label: locale === "th" ? "กล่องข้อความ" : "Inbox", icon: Inbox, disabled: false, href: "/app/inbox", roles: ["OWNER", "ADMIN", "AGENT", "QC"] },
    { label: locale === "th" ? "ลูกค้า" : "Customers", icon: Users, disabled: true, roles: ["OWNER", "ADMIN", "AGENT"] },
    { label: locale === "th" ? "รายงาน" : "Reports", icon: ChartNoAxesColumn, disabled: true, roles: ["OWNER", "ADMIN", "QC", "VIEWER"] },
    { label: locale === "th" ? "คลังความรู้" : "Knowledge", icon: BookOpen, disabled: true, roles: ["OWNER", "ADMIN", "AGENT"] },
    { label: locale === "th" ? "ตั้งค่า" : "Settings", icon: Settings, disabled: false, href: "/app/settings", roles: ["OWNER", "ADMIN", "AGENT"] }
  ];

  const currentRole = role || "OWNER";
  const filteredNavItems = navItems.filter((item) => item.roles.includes(currentRole));


  useEffect(() => {
    // 15 minutes = 15 * 60 * 1000 ms
    const INACTIVITY_TIMEOUT = 15 * 60 * 1000;
    let timeoutId: NodeJS.Timeout;

    function handleResetTimer() {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleLogout, INACTIVITY_TIMEOUT);
    }

    function handleLogout() {
      window.localStorage.removeItem("omnichat.accessToken");
      window.localStorage.removeItem("omnichat.refreshToken");
      window.localStorage.removeItem("omnichat.user");

      document.cookie = "omnichat.accessToken=; path=/; max-age=0";
      document.cookie = "omnichat.tenantId=; path=/; max-age=0";
      document.cookie = "omnichat.workspaceId=; path=/; max-age=0";

      window.location.href = "/login";
    }

    const events = ["mousemove", "keydown", "mousedown", "scroll", "click", "touchstart"];
    events.forEach((event) => {
      window.addEventListener(event, handleResetTimer);
    });

    handleResetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, handleResetTimer);
      });
    };
  }, []);

  return (
    <main className="flex h-screen overflow-hidden bg-[#F7F7FA] text-foreground">
      <nav aria-label="Primary" className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-border bg-white py-3">
        {filteredNavItems.map((item) => {
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
        {/* Page content — no padding, pages manage their own layout */}
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </section>
    </main>
  );
}
