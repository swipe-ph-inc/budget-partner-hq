"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Sun, Moon, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useTheme } from "@/components/providers/theme-provider";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/accounts": "Accounts",
  "/credit-cards": "Credit Cards",
  "/transactions": "Transactions",
  "/expenses": "Expenses",
  "/savings": "Savings Goals",
  "/subscriptions": "Subscriptions",
  "/debts": "Debts",
  "/invoices": "Invoices",
  "/categories": "Categories & Merchants",
  "/profile": "Profile & Settings",
  "/calendar": "Calendar",
  "/pricing": "Plans & pricing",
};

interface TopbarProps {
  onMenuClick?: () => void;
  displayName: string | null;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Topbar({ onMenuClick, displayName }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();

  const title =
    Object.entries(PAGE_TITLES).find(([route]) =>
      pathname === route || pathname.startsWith(route + "/")
    )?.[1] ?? "Budget Partner HQ";

  async function handleLogout() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/login";
  }

  const initials = getInitials(displayName);

  return (
    <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-sm sm:min-h-16 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {onMenuClick && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <h1 className="truncate text-lg font-display font-semibold text-foreground sm:text-xl">
          {title}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="User menu"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {initials}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            {displayName && (
              <>
                <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem onClick={toggleTheme}>
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
