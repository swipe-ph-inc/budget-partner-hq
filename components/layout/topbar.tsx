"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/notification-bell";

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
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();

  const title =
    Object.entries(PAGE_TITLES).find(([route]) =>
      pathname === route || pathname.startsWith(route + "/")
    )?.[1] ?? "Budget Partner HQ";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-sm sm:h-16 sm:px-6">
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
      </div>
    </header>
  );
}
