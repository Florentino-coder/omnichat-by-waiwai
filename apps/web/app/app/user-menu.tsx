"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { Badge } from "@omnichat/ui";

export function UserMenu() {
  return (
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
              window.location.href = "/login";
            }}
          >
            <LogOut size={14} aria-hidden="true" />
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}
