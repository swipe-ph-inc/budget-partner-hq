"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Landmark,
  CreditCard,
  Receipt,
  ArrowLeftRight,
  PiggyBank,
  RefreshCcw,
  FileText,
  Tag,
  ChevronLeft,
  ChevronRight,
  User,
  TrendingUp,
  LogOut,
  CalendarDays,
  Lock,
  Gem,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/** Routes that require Pro (free users see a lock in the sidebar; pages show an upgrade prompt). */
const PRO_ONLY_HREFS = new Set([
  "/calendar",
  "/savings",
  "/debts",
  "/invoices",
]);

const navItems = [
  {
    group: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    group: "Money",
    items: [
      { href: "/accounts", label: "Accounts", icon: Landmark },
      { href: "/credit-cards", label: "Credit Cards", icon: CreditCard },
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/expenses", label: "Expenses", icon: Receipt },
    ],
  },
  {
    group: "Planning",
    items: [
      { href: "/savings", label: "Savings Goals", icon: PiggyBank },
      { href: "/subscriptions", label: "Subscriptions", icon: RefreshCcw },
      { href: "/debts", label: "Debts", icon: TrendingUp },
    ],
  },
  {
    group: "Business",
    items: [
      { href: "/invoices", label: "Invoices", icon: FileText },
      { href: "/categories", label: "Categories", icon: Tag },
    ],
  },
  {
    group: "Account",
    items: [{ href: "/pricing", label: "Plans & pricing", icon: Gem }],
  },
];

interface SidebarProps {
  /** Mobile drawer open (desktop ignores). */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** Controlled collapse (desktop); must stay in sync with main content `margin-left`. */
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** When false, Pro-only nav items show a lock (links still work; page shows upgrade UI). */
  isPro: boolean;
}

export default function Sidebar({
  mobileOpen = false,
  onMobileClose,
  collapsed,
  onCollapsedChange,
  isPro,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  function closeMobileIfNeeded() {
    onMobileClose?.();
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-white/5 transition-all duration-300 ease-in-out",
        "bg-primary shadow-sidebar",
        "w-[min(18rem,calc(100vw-2rem))]",
        collapsed ? "md:w-16" : "md:w-60",
        "-translate-x-full md:translate-x-0",
        mobileOpen && "translate-x-0"
      )}
    >
      {/* Logo — centered; collapse control sits top-right */}
      <div className="relative h-16 shrink-0 border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Link
            href="/dashboard"
            onClick={closeMobileIfNeeded}
            className="pointer-events-auto flex items-center justify-center"
          >
            <Image
              src="/bp_logo.png"
              alt="Budget Partner HQ"
              width={176}
              height={56}
              priority
              className={cn(
                "object-contain object-center",
                collapsed ? "h-9 w-9" : "h-10 w-auto max-w-[9.5rem]"
              )}
            />
          </Link>
        </div>
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white md:block"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {navItems.map((group) => (
          <div key={group.group}>
            {!collapsed && (
              <div className="px-2 mb-1">
                <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">
                  {group.group}
                </span>
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                const proOnly = PRO_ONLY_HREFS.has(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeMobileIfNeeded}
                      className={cn(
                        "sidebar-link",
                        isActive && "active",
                        collapsed && "justify-center px-2",
                        !isPro && proOnly && "opacity-80"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon
                        className={cn(
                          "shrink-0",
                          collapsed ? "h-5 w-5" : "h-4 w-4"
                        )}
                      />
                      {!collapsed && (
                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="truncate">{item.label}</span>
                          {!isPro && proOnly && (
                            <Lock
                              className="h-3.5 w-3.5 shrink-0 text-white/45"
                              aria-label="Pro feature"
                            />
                          )}
                        </span>
                      )}
                      {collapsed && !isPro && proOnly && (
                        <span className="sr-only">Pro feature</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-white/10 p-2 space-y-0.5">
        <Link
          href="/profile"
          onClick={closeMobileIfNeeded}
          className={cn(
            "sidebar-link",
            pathname.startsWith("/profile") && "active",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "Profile" : undefined}
        >
          <User className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} />
          {!collapsed && <span>Profile</span>}
        </Link>

        <button
          onClick={handleSignOut}
          className={cn(
            "sidebar-link w-full text-left",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
