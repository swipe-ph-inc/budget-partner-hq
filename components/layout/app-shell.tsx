"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { AIChatButton } from "@/components/chat/ai-chat-button";

export function AppShell({
  children,
  isPro,
}: {
  children: React.ReactNode;
  /** Pro / active paid plan — unlocks AI chat and premium areas. */
  isPro: boolean;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  /** Kept in sync with sidebar width: expanded `w-60` → `ml-60`, collapsed `w-16` → `ml-16`. */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
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
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
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
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">{children}</main>
      </div>

      <AIChatButton aiEnabled={isPro} />
    </div>
  );
}
