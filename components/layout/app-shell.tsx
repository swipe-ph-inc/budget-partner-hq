"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { AIChatButton } from "@/components/chat/ai-chat-button";
import { DisplayCurrencyProvider } from "@/components/providers/display-currency-provider";

export function AppShell({
  children,
  isPro,
  baseCurrency,
  displayName,
}: {
  children: React.ReactNode;
  isPro: boolean;
  baseCurrency: string;
  displayName: string | null;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  /** Kept in sync with sidebar width: expanded `w-60` → `ml-60`, collapsed `w-16` → `ml-16`. */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-background">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        isPro={isPro}
      />

      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col overflow-hidden transition-[margin] duration-300 ease-in-out",
          sidebarCollapsed ? "md:ml-16" : "md:ml-60"
        )}
      >
        <Topbar onMenuClick={() => setMobileNavOpen(true)} displayName={displayName} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <DisplayCurrencyProvider baseCurrency={baseCurrency}>{children}</DisplayCurrencyProvider>
        </main>
      </div>

      <AIChatButton aiEnabled={isPro} />
    </div>
  );
}
