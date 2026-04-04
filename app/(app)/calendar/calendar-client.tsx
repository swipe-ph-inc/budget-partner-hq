"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { TX_TYPE_COLORS, TX_TYPE_LABELS, formatCurrency } from "@/lib/utils";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

type View = "month" | "week" | "day" | "year";

interface Transaction {
  id: string;
  date: string;
  type: string;
  amount: number;
  fee_amount?: number | null;
  description?: string | null;
  note?: string | null;
  categories?: { name: string; color?: string | null } | null;
  merchants?: { name: string } | null;
  accounts?: { name: string; currency_code: string } | null;
  credit_cards?: { name: string } | null;
}

interface Props {
  transactions: Transaction[];
  initialView: View;
  initialDate: string;
  todayStr: string;
}

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ----- helpers ---------------------------------------------------------------

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseDate(s: string) {
  return new Date(s + "T00:00:00");
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function txLabel(tx: Transaction) {
  return (
    tx.description ||
    tx.merchants?.name ||
    tx.categories?.name ||
    TX_TYPE_LABELS[tx.type] ||
    tx.type
  );
}

// ----- sub-components --------------------------------------------------------

function TxTooltipContent({ tx }: { tx: Transaction }) {
  const displayCurrency = useDisplayCurrency();
  const colors = TX_TYPE_COLORS[tx.type] ?? TX_TYPE_COLORS.expense;
  const isNegative = ["expense", "credit_charge", "transfer"].includes(tx.type);
  const amount = tx.amount + (tx.fee_amount ?? 0);

  return (
    <div className="w-64 space-y-2">
      {/* Type badge + amount */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
            colors.bg,
            colors.text
          )}
        >
          {TX_TYPE_LABELS[tx.type] ?? tx.type}
        </span>
        <span className={cn("text-sm font-bold", colors.text)}>
          {isNegative ? "−" : "+"}
          {formatCurrency(amount, displayCurrency)}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm font-medium text-foreground leading-snug">
        {txLabel(tx)}
      </p>

      {/* Meta rows */}
      <div className="space-y-1 text-xs text-muted-foreground">
        {tx.categories?.name && (
          <div className="flex items-center gap-1.5">
            <span className="opacity-60">Category</span>
            <span className="font-medium text-foreground">{tx.categories.name}</span>
          </div>
        )}
        {tx.merchants?.name && (
          <div className="flex items-center gap-1.5">
            <span className="opacity-60">Merchant</span>
            <span className="font-medium text-foreground">{tx.merchants.name}</span>
          </div>
        )}
        {tx.accounts?.name && (
          <div className="flex items-center gap-1.5">
            <span className="opacity-60">Account</span>
            <span className="font-medium text-foreground">{tx.accounts.name}</span>
          </div>
        )}
        {tx.credit_cards?.name && (
          <div className="flex items-center gap-1.5">
            <span className="opacity-60">Card</span>
            <span className="font-medium text-foreground">{tx.credit_cards.name}</span>
          </div>
        )}
        {tx.fee_amount && tx.fee_amount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="opacity-60">Fee</span>
            <span className="font-medium text-foreground">
              {formatCurrency(tx.fee_amount, displayCurrency)}
            </span>
          </div>
        )}
        {tx.note && (
          <div className="pt-1 border-t border-border mt-1">
            <p className="italic text-muted-foreground">{tx.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TxChip({ tx, compact = false }: { tx: Transaction; compact?: boolean }) {
  const displayCurrency = useDisplayCurrency();
  const colors = TX_TYPE_COLORS[tx.type] ?? TX_TYPE_COLORS.expense;
  const isNegative = ["expense", "credit_charge", "transfer"].includes(tx.type);
  const amount = tx.amount + (tx.fee_amount ?? 0);

  return (
    <TooltipRoot delayDuration={300}>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium truncate cursor-default",
            colors.bg,
            colors.text,
            compact ? "max-w-full" : "max-w-[calc(100%-4px)]"
          )}
        >
          <span className="truncate">{txLabel(tx)}</span>
          {!compact && (
            <span className="shrink-0 font-semibold">
              {isNegative ? "-" : "+"}
              {formatCurrency(amount, displayCurrency)}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" align="start">
        <TxTooltipContent tx={tx} />
      </TooltipContent>
    </TooltipRoot>
  );
}

function TxRow({ tx }: { tx: Transaction }) {
  const displayCurrency = useDisplayCurrency();
  const colors = TX_TYPE_COLORS[tx.type] ?? TX_TYPE_COLORS.expense;
  const isNegative = ["expense", "credit_charge", "transfer"].includes(tx.type);
  const amount = tx.amount + (tx.fee_amount ?? 0);

  return (
    <div className={cn("flex items-center gap-3 rounded-lg p-3 border", colors.bg, colors.border)}>
      <div
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          tx.type === "income" ? "bg-success-600" :
          tx.type === "expense" ? "bg-destructive" :
          tx.type === "credit_charge" ? "bg-warning-700" :
          "bg-primary"
        )}
      />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", colors.text)}>{txLabel(tx)}</p>
        <p className="text-xs text-muted-foreground truncate">
          {TX_TYPE_LABELS[tx.type] ?? tx.type}
          {tx.categories?.name ? ` · ${tx.categories.name}` : ""}
          {tx.accounts?.name ? ` · ${tx.accounts.name}` : ""}
          {tx.credit_cards?.name ? ` · ${tx.credit_cards.name}` : ""}
        </p>
        {tx.note && <p className="text-xs text-muted-foreground/70 truncate">{tx.note}</p>}
      </div>
      <span className={cn("text-sm font-semibold shrink-0", colors.text)}>
        {isNegative ? "-" : "+"}{formatCurrency(amount, displayCurrency)}
      </span>
    </div>
  );
}

// ----- Month view ------------------------------------------------------------

function MonthView({
  anchorDate,
  todayStr,
  txByDate,
}: {
  anchorDate: Date;
  todayStr: string;
  txByDate: Record<string, Transaction[]>;
}) {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay();

  const cells: Date[] = [];
  const gridStart = addDays(firstOfMonth, -startDay);
  for (let i = 0; i < 42; i++) {
    cells.push(addDays(gridStart, i));
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAYS_SHORT.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto" style={{ gridAutoRows: "minmax(100px,1fr)" }}>
        {cells.map((cell) => {
          const key = dateKey(cell);
          const isThisMonth = cell.getMonth() === month;
          const isToday = key === todayStr;
          const txs = txByDate[key] ?? [];
          const maxVisible = 3;
          const overflow = txs.length - maxVisible;

          return (
            <div
              key={key}
              className={cn(
                "border-b border-r border-border p-1.5 flex flex-col gap-0.5 min-h-0",
                !isThisMonth && "bg-secondary/20"
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    isToday
                      ? "bg-primary text-primary-foreground font-bold"
                      : isThisMonth
                      ? "text-foreground"
                      : "text-muted-foreground/50"
                  )}
                >
                  {cell.getDate()}
                </span>
              </div>
              {txs.slice(0, maxVisible).map((tx) => (
                <TxChip key={tx.id} tx={tx} />
              ))}
              {overflow > 0 && (
                <span className="text-xs text-muted-foreground pl-1">+{overflow} more</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----- Week view -------------------------------------------------------------

function WeekView({
  anchorDate,
  todayStr,
  txByDate,
}: {
  anchorDate: Date;
  todayStr: string;
  txByDate: Record<string, Transaction[]>;
}) {
  const startOfWeek = new Date(anchorDate);
  startOfWeek.setDate(anchorDate.getDate() - anchorDate.getDay());
  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek, i));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border shrink-0">
        {days.map((d) => {
          const key = dateKey(d);
          const isToday = key === todayStr;
          return (
            <div key={key} className="py-3 text-center border-r border-border last:border-r-0">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">{DAYS_SHORT[d.getDay()]}</div>
              <div
                className={cn(
                  "mt-1 mx-auto h-8 w-8 flex items-center justify-center rounded-full text-sm font-semibold",
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                )}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto">
        {days.map((d) => {
          const key = dateKey(d);
          const txs = txByDate[key] ?? [];
          return (
            <div key={key} className="border-r border-border last:border-r-0 p-2 flex flex-col gap-1.5 overflow-y-auto">
              {txs.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground/40">—</span>
                </div>
              ) : (
                txs.map((tx) => <TxChip key={tx.id} tx={tx} compact />)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----- Day view --------------------------------------------------------------

function DayView({
  anchorDate,
  todayStr,
  txByDate,
}: {
  anchorDate: Date;
  todayStr: string;
  txByDate: Record<string, Transaction[]>;
}) {
  const displayCurrency = useDisplayCurrency();
  const key = dateKey(anchorDate);
  const txs = txByDate[key] ?? [];
  const isToday = key === todayStr;

  const totalIn = txs
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = txs
    .filter((t) => ["expense", "credit_charge"].includes(t.type))
    .reduce((s, t) => s + t.amount + (t.fee_amount ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
      {/* Date headline */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className={cn(
            "h-14 w-14 rounded-2xl flex flex-col items-center justify-center shrink-0",
            isToday ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
          )}
        >
          <span className="text-xl font-bold leading-none">{anchorDate.getDate()}</span>
          <span className="text-xs mt-0.5 opacity-80">{MONTHS_SHORT[anchorDate.getMonth()]}</span>
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">
            {DAYS_SHORT[anchorDate.getDay()]}, {MONTHS_LONG[anchorDate.getMonth()]} {anchorDate.getDate()}, {anchorDate.getFullYear()}
          </p>
          <p className="text-sm text-muted-foreground">
            {txs.length === 0
              ? "No transactions"
              : `${txs.length} transaction${txs.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {txs.length > 0 && (
          <div className="ml-auto flex gap-4 text-right">
            <div>
              <p className="text-xs text-muted-foreground">In</p>
              <p className="text-sm font-semibold text-success-600">+{formatCurrency(totalIn, displayCurrency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Out</p>
              <p className="text-sm font-semibold text-destructive">-{formatCurrency(totalOut, displayCurrency)}</p>
            </div>
          </div>
        )}
      </div>

      {txs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <CalendarDays className="h-12 w-12 opacity-20" />
          <p className="text-sm">No transactions on this day</p>
        </div>
      ) : (
        <div className="space-y-2">
          {txs.map((tx) => <TxRow key={tx.id} tx={tx} />)}
        </div>
      )}
    </div>
  );
}

// ----- Year view -------------------------------------------------------------

function YearView({
  anchorDate,
  todayStr,
  txByDate,
  onNavigate,
}: {
  anchorDate: Date;
  todayStr: string;
  txByDate: Record<string, Transaction[]>;
  onNavigate: (date: string, view: View) => void;
}) {
  const displayCurrency = useDisplayCurrency();
  const year = anchorDate.getFullYear();

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }, (_, m) => {
          const firstOfMonth = new Date(year, m, 1);
          const startDay = firstOfMonth.getDay();
          const cells: (Date | null)[] = Array.from({ length: startDay }, () => null);
          const daysInMonth = new Date(year, m + 1, 0).getDate();
          for (let d = 1; d <= daysInMonth; d++) {
            cells.push(new Date(year, m, d));
          }
          while (cells.length % 7 !== 0) cells.push(null);

          return (
            <div key={m} className="rounded-xl border border-border bg-card p-3">
              <button
                className="w-full text-left text-sm font-semibold text-foreground hover:text-primary mb-2 transition-colors"
                onClick={() => onNavigate(`${year}-${String(m + 1).padStart(2, "0")}-01`, "month")}
              >
                {MONTHS_LONG[m]}
              </button>

              {/* Mini day headers */}
              <div className="grid grid-cols-7 mb-1">
                {["S","M","T","W","T","F","S"].map((d, i) => (
                  <div key={i} className="text-center text-[9px] text-muted-foreground/60 font-medium">{d}</div>
                ))}
              </div>

              {/* Mini grid */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((cell, i) => {
                  if (!cell) return <div key={`e${i}`} />;
                  const key = dateKey(cell);
                  const dayTxs = txByDate[key] ?? [];
                  const hasTx = dayTxs.length > 0;
                  const isToday = key === todayStr;
                  const btn = (
                    <button
                      key={key}
                      onClick={() => onNavigate(key, "day")}
                      className={cn(
                        "relative mx-auto flex h-5 w-5 items-center justify-center rounded-full text-[10px] transition-colors hover:bg-primary/20",
                        isToday ? "bg-primary text-primary-foreground font-bold" : "text-foreground/70"
                      )}
                    >
                      {cell.getDate()}
                      {hasTx && !isToday && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                  if (!hasTx) return btn;
                  return (
                    <TooltipRoot key={key} delayDuration={300}>
                      <TooltipTrigger asChild>{btn}</TooltipTrigger>
                      <TooltipContent side="top" align="center">
                        <div className="space-y-1 w-48">
                          <p className="text-xs font-semibold text-foreground mb-1">
                            {MONTHS_SHORT[cell.getMonth()]} {cell.getDate()} · {dayTxs.length} transaction{dayTxs.length !== 1 ? "s" : ""}
                          </p>
                          {dayTxs.slice(0, 4).map((tx) => {
                            const c = TX_TYPE_COLORS[tx.type] ?? TX_TYPE_COLORS.expense;
                            const neg = ["expense","credit_charge","transfer"].includes(tx.type);
                            return (
                              <div key={tx.id} className="flex items-center justify-between gap-2 text-xs">
                                <span className={cn("truncate", c.text)}>{txLabel(tx)}</span>
                                <span className={cn("shrink-0 font-semibold", c.text)}>
                                  {neg ? "−" : "+"}{formatCurrency(tx.amount, displayCurrency)}
                                </span>
                              </div>
                            );
                          })}
                          {dayTxs.length > 4 && (
                            <p className="text-xs text-muted-foreground">+{dayTxs.length - 4} more</p>
                          )}
                        </div>
                      </TooltipContent>
                    </TooltipRoot>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----- Main component --------------------------------------------------------

export default function CalendarClient({
  transactions,
  initialView,
  initialDate,
  todayStr,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [anchorStr, setAnchorStr] = useState(initialDate);
  const anchorDate = useMemo(() => parseDate(anchorStr), [anchorStr]);

  const txByDate = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const tx of transactions) {
      if (!map[tx.date]) map[tx.date] = [];
      map[tx.date].push(tx);
    }
    return map;
  }, [transactions]);

  const navigate = useCallback(
    (newDate: string, newView: View = view) => {
      setView(newView);
      setAnchorStr(newDate);
      router.push(`/calendar?view=${newView}&date=${newDate}`);
    },
    [router, view]
  );

  function handleViewChange(v: View) {
    navigate(anchorStr, v);
  }

  function handlePrev() {
    const d = new Date(anchorDate);
    if (view === "day") d.setDate(d.getDate() - 1);
    else if (view === "week") d.setDate(d.getDate() - 7);
    else if (view === "month") d.setMonth(d.getMonth() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    navigate(dateKey(d));
  }

  function handleNext() {
    const d = new Date(anchorDate);
    if (view === "day") d.setDate(d.getDate() + 1);
    else if (view === "week") d.setDate(d.getDate() + 7);
    else if (view === "month") d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    navigate(dateKey(d));
  }

  function handleToday() {
    navigate(todayStr);
  }

  // Header label
  const headerLabel = useMemo(() => {
    if (view === "day") {
      return `${DAYS_SHORT[anchorDate.getDay()]}, ${MONTHS_LONG[anchorDate.getMonth()]} ${anchorDate.getDate()}, ${anchorDate.getFullYear()}`;
    }
    if (view === "week") {
      const startOfWeek = new Date(anchorDate);
      startOfWeek.setDate(anchorDate.getDate() - anchorDate.getDay());
      const endOfWeek = addDays(startOfWeek, 6);
      if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
        return `${MONTHS_LONG[startOfWeek.getMonth()]} ${startOfWeek.getDate()} – ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
      }
      return `${MONTHS_SHORT[startOfWeek.getMonth()]} ${startOfWeek.getDate()} – ${MONTHS_SHORT[endOfWeek.getMonth()]} ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
    }
    if (view === "year") return `${anchorDate.getFullYear()}`;
    return `${MONTHS_LONG[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
  }, [view, anchorDate]);

  const VIEWS: { key: View; label: string }[] = [
    { key: "day", label: "Day" },
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "year", label: "Year" },
  ];

  return (
    <TooltipProvider>
    <div className="flex flex-col h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
        {/* Today button */}
        <Button variant="outline" size="sm" className="text-xs" onClick={handleToday}>
          Today
        </Button>

        {/* Prev / Next */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrev} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNext} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Date label */}
        <h2 className="text-sm font-semibold text-foreground flex-1 truncate">{headerLabel}</h2>

        {/* View switcher */}
        <div className="flex items-center rounded-lg border border-border overflow-hidden shrink-0">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => handleViewChange(v.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                view === v.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* View body */}
      {view === "month" && (
        <MonthView anchorDate={anchorDate} todayStr={todayStr} txByDate={txByDate} />
      )}
      {view === "week" && (
        <WeekView anchorDate={anchorDate} todayStr={todayStr} txByDate={txByDate} />
      )}
      {view === "day" && (
        <DayView anchorDate={anchorDate} todayStr={todayStr} txByDate={txByDate} />
      )}
      {view === "year" && (
        <YearView
          anchorDate={anchorDate}
          todayStr={todayStr}
          txByDate={txByDate}
          onNavigate={navigate}
        />
      )}
    </div>
    </TooltipProvider>
  );
}
