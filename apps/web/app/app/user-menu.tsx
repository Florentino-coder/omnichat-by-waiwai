"use client";

import { Building2, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@omnichat/ui";
import { useLanguage } from "../lib/language-context";
import { getMessages } from "../lib/i18n";

type UserData = {
  displayName?: string;
  email?: string;
  role?: string;
};

export function UserMenu() {
  const { locale } = useLanguage();
  const t = getMessages(locale);
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("omnichat.user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // Ignore
    }
  }, []);

  const displayName = user?.displayName ?? "User";
  const email = user?.email ?? "";
  const role = user?.role ?? "AGENT";
  const avatarChar = displayName.charAt(0).toUpperCase();

  function handleLogout(): void {
    window.localStorage.removeItem("omnichat.accessToken");
    window.localStorage.removeItem("omnichat.refreshToken");
    window.localStorage.removeItem("omnichat.user");

    document.cookie = "omnichat.accessToken=; path=/; max-age=0";
    document.cookie = "omnichat.tenantId=; path=/; max-age=0";
    document.cookie = "omnichat.workspaceId=; path=/; max-age=0";

    window.location.href = "/login";
  }

  return (
    <div className="group relative">
      <button
        type="button"
        className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-sm text-foreground shadow-sm hover:bg-secondary transition-colors"
        aria-label="User menu"
        id="user-menu-btn"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
          {avatarChar}
        </span>
        <span className="hidden sm:block text-xs font-medium">{displayName}</span>
        <Badge variant="muted" className="hidden sm:inline-flex text-[10px] py-0 px-1.5">
          {role}
        </Badge>
      </button>
      {/* Dropdown */}
      <div className="absolute right-0 top-full z-50 mt-1 hidden w-52 rounded-lg border border-border bg-white shadow-lg group-focus-within:block">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        </div>
        <div className="py-1">
          <Link
            href="/tenant-select"
            className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-secondary"
          >
            <Building2 size={14} aria-hidden="true" />
            {t.switchWorkspace}
          </Link>
          {role !== "QC" && role !== "VIEWER" && (
            <Link
              href="/app/settings"
              className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-secondary"
            >
              <Settings size={14} aria-hidden="true" />
              {t.settings}
            </Link>
          )}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-danger/10"
            onClick={handleLogout}
          >
            <LogOut size={14} aria-hidden="true" />
            {t.logout}
          </button>
        </div>
      </div>
    </div>
  );
}
