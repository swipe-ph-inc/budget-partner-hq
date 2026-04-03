"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, CreditCard, PiggyBank, RefreshCcw, TrendingDown, AlertTriangle, Wallet, X, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";

type NotificationType =
  | "subscription_due"
  | "subscription_logged"
  | "credit_card_due"
  | "credit_card_overdue"
  | "budget_overspent"
  | "savings_milestone"
  | "low_buffer"
  | "high_credit_utilisation"
  | "instalment_due"
  | "instalment_last_payment"
  | "instalment_complete";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  subscription_due:        <RefreshCcw className="h-4 w-4" />,
  subscription_logged:     <RefreshCcw className="h-4 w-4" />,
  credit_card_due:         <CreditCard className="h-4 w-4" />,
  credit_card_overdue:     <CreditCard className="h-4 w-4" />,
  budget_overspent:        <Wallet className="h-4 w-4" />,
  savings_milestone:       <PiggyBank className="h-4 w-4" />,
  low_buffer:              <TrendingDown className="h-4 w-4" />,
  high_credit_utilisation: <AlertTriangle className="h-4 w-4" />,
  instalment_due:          <Layers className="h-4 w-4" />,
  instalment_last_payment: <Layers className="h-4 w-4" />,
  instalment_complete:     <Layers className="h-4 w-4" />,
};

const TYPE_COLOUR: Record<NotificationType, string> = {
  subscription_due:        "bg-warning/10 text-warning-700",
  subscription_logged:     "bg-success/10 text-success-600",
  credit_card_due:         "bg-warning/10 text-warning-700",
  credit_card_overdue:     "bg-destructive/10 text-destructive",
  budget_overspent:        "bg-destructive/10 text-destructive",
  savings_milestone:       "bg-success/10 text-success-600",
  low_buffer:              "bg-warning/10 text-warning-700",
  high_credit_utilisation: "bg-destructive/10 text-destructive",
  instalment_due:          "bg-primary/10 text-primary",
  instalment_last_payment: "bg-warning/10 text-warning-700",
  instalment_complete:     "bg-success/10 text-success-600",
};

/** Session key — generate once per browser session to avoid spamming the endpoint */
const SESSION_KEY = "notif_generated_at";

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setUnread(data.unread_count ?? 0);
  }, []);

  // Generate once per session, then fetch
  useEffect(() => {
    const lastGenerated = sessionStorage.getItem(SESSION_KEY);
    const today = new Date().toISOString().slice(0, 10);

    const run = async () => {
      if (lastGenerated !== today) {
        await fetch("/api/notifications/generate", { method: "POST" });
        sessionStorage.setItem(SESSION_KEY, today);
      }
      await fetchNotifications();
    };
    run();
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleOpen() {
    setOpen((v) => !v);
    if (!open) {
      setLoading(true);
      await fetchNotifications();
      setLoading(false);
    }
  }

  async function markRead(id: string, link?: string | null) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnread((c) => Math.max(0, c - 1));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    if (link) {
      setOpen(false);
      router.push(link);
    }
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        onClick={handleOpen}
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 rounded-xl border border-border bg-card shadow-float animate-fade-in overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm text-foreground">Notifications</span>
              {unread > 0 && (
                <span className="text-xs font-medium text-destructive bg-destructive/10 rounded-full px-1.5 py-0.5">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAllRead}>
                  <Check className="h-3 w-3 mr-1" /> Mark all read
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center space-y-1">
                <Bell className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
                <p className="text-sm text-muted-foreground">You&apos;re all caught up!</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id, n.link)}
                  className={cn(
                    "w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-secondary/50",
                    !n.is_read && "bg-primary/[0.03]"
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    "mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                    TYPE_COLOUR[n.type as NotificationType] ?? "bg-secondary text-muted-foreground"
                  )}>
                    {TYPE_ICON[n.type as NotificationType] ?? <Bell className="h-4 w-4" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm leading-snug", !n.is_read ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.body}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!n.is_read && (
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <>
              <Separator />
              <div className="px-4 py-2 text-xs text-center text-muted-foreground">
                Showing last {notifications.length} notifications
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
