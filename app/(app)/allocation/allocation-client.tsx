"use client";

import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, addMonths, subMonths, parseISO } from "date-fns";
import type { Database } from "@/types/database";
import { formatCurrency, cn } from "@/lib/utils";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { splitSafeToSpend } from "@/lib/allocation/period-splits";
import { approveAllocationAction } from "./actions";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { BudgetSummary } from "./page";

type AllocationRow = Database["public"]["Tables"]["monthly_allocations"]["Row"];
type ItemRow = Database["public"]["Tables"]["allocation_items"]["Row"];
type AllocationWithItems = AllocationRow & { items?: ItemRow[] | null };

// ── Period helpers ────────────────────────────────────────────────────────────
type Period = "weekly" | "monthly" | "yearly";

const PERIOD_LABELS: Record<Period, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const PERIOD_MULTIPLIER: Record<Period, number> = {
  weekly: 1 / 4.345,
  monthly: 1,
  yearly: 12,
};

function scaleAmount(amount: number, period: Period): number {
  return amount * PERIOD_MULTIPLIER[period];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function itemResourceLink(item: ItemRow): { href: string; label: string } | null {
  if (item.linked_debt_id) return { href: "/debts", label: "Open debts" };
  if (item.linked_credit_card_id)
    return { href: `/credit-cards/${item.linked_credit_card_id}`, label: "Card" };
  if (item.linked_subscription_id) return { href: "/subscriptions", label: "Subscriptions" };
  if (item.linked_account_id) return { href: `/accounts/${item.linked_account_id}`, label: "Account" };
  return null;
}

function groupLabel(cat: ItemRow["category"]): string {
  if (cat === "obligation") return "Obligations";
  if (cat === "goal") return "Goals";
  return "Spending";
}

// ── Budget Overview ───────────────────────────────────────────────────────────
function OutflowRow({
  label,
  amount,
  count,
  currency,
}: {
  label: string;
  amount: number;
  count: number;
  currency: string;
}) {
  if (amount <= 0 && count === 0) return null;
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-muted-foreground">
        {label}
        {count > 0 && (
          <span className="ml-1.5 text-xs bg-secondary px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </span>
      <span className="font-medium tabular-nums">{formatCurrency(amount, currency)}</span>
    </div>
  );
}

function BudgetOverview({
  summary,
  period,
  onPeriodChange,
  currency,
}: {
  summary: BudgetSummary;
  period: Period;
  onPeriodChange: (p: Period) => void;
  currency: string;
}) {
  const s = (n: number) => scaleAmount(n, period);

  const scaledIncome = s(summary.avgMonthlyIncome);
  const scaledOutflows = s(summary.outflows.total);
  const budgetLeft = scaledIncome - scaledOutflows;

  const usedPct =
    scaledIncome > 0 ? Math.min(100, (scaledOutflows / scaledIncome) * 100) : 0;

  const budgetLeftColor =
    budgetLeft < 0
      ? "#ef4444"
      : budgetLeft < scaledIncome * 0.2
      ? "#cea843"
      : "#28c095";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Budget Overview</CardTitle>
          {/* Period toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
            {(["weekly", "monthly", "yearly"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-secondary"
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Income */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Income
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground">Expected (avg)</span>
              <span className="font-medium tabular-nums">
                {summary.avgMonthlyIncome > 0
                  ? formatCurrency(scaledIncome, currency)
                  : <span className="text-xs text-muted-foreground italic">No snapshot — add income data</span>}
              </span>
            </div>
            {period === "monthly" && (
              <div className="flex items-center justify-between text-sm py-1">
                <span className="text-muted-foreground">Received this month</span>
                <span className="font-medium tabular-nums text-emerald-600">
                  {formatCurrency(summary.actualIncomeThisMonth, currency)}
                </span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Fixed Outflows */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Fixed Outflows
          </p>
          <div>
            <OutflowRow
              label="Debt payments"
              amount={s(summary.outflows.debts)}
              count={summary.outflowCounts.debts}
              currency={currency}
            />
            <OutflowRow
              label="Credit card minimums"
              amount={s(summary.outflows.creditCards)}
              count={summary.outflowCounts.creditCards}
              currency={currency}
            />
            <OutflowRow
              label="Instalment plans"
              amount={s(summary.outflows.instalments)}
              count={summary.outflowCounts.instalments}
              currency={currency}
            />
            <OutflowRow
              label="Subscriptions"
              amount={s(summary.outflows.subscriptions)}
              count={summary.outflowCounts.subscriptions}
              currency={currency}
            />
            <OutflowRow
              label="Savings goals"
              amount={s(summary.outflows.savings)}
              count={summary.outflowCounts.savings}
              currency={currency}
            />
          </div>
          <div className="flex items-center justify-between text-sm font-semibold pt-1 border-t border-border">
            <span>Total outflows</span>
            <span className="tabular-nums text-destructive">
              {formatCurrency(scaledOutflows, currency)}
            </span>
          </div>
        </div>

        <Separator />

        {/* Budget Left */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Budget Left
          </p>
          <div className="flex items-baseline gap-3">
            <span
              className="font-display text-3xl font-bold tabular-nums"
              style={{ color: budgetLeftColor }}
            >
              {formatCurrency(budgetLeft, currency)}
            </span>
            <span className="text-xs text-muted-foreground">
              per {period === "weekly" ? "week" : period === "monthly" ? "month" : "year"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Expected income − total fixed outflows
          </p>
          {scaledIncome > 0 && (
            <div className="space-y-1.5">
              <Progress
                value={usedPct}
                indicatorClassName={
                  usedPct >= 100 ? "bg-destructive" :
                  usedPct >= 80 ? "bg-yellow-500" :
                  "bg-primary"
                }
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{usedPct.toFixed(0)}% committed to outflows</span>
                <span>{(100 - Math.min(100, usedPct)).toFixed(0)}% free</span>
              </div>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}

// ── Main Client ───────────────────────────────────────────────────────────────
interface Props {
  monthStart: string;
  allocation: AllocationWithItems | null;
  items: ItemRow[];
  accountsTotal: number;
  spentMtd: number;
  todayStr: string;
  budgetSummary: BudgetSummary;
}

export function AllocationClient({
  monthStart,
  allocation,
  items,
  accountsTotal,
  spentMtd,
  todayStr,
  budgetSummary,
}: Props) {
  const router = useRouter();
  const displayCurrency = useDisplayCurrency();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("monthly");
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, String(i.amount)]))
  );

  const monthDate = parseISO(`${monthStart}T12:00:00`);
  const prevMonth = format(subMonths(monthDate, 1), "yyyy-MM-dd");
  const nextMonth = format(addMonths(monthDate, 1), "yyyy-MM-dd");
  const monthTitle = format(monthDate, "MMMM yyyy");

  const safe = allocation?.safe_to_spend ?? null;
  const splits = useMemo(() => splitSafeToSpend(safe), [safe]);

  const canApprove =
    allocation &&
    (allocation.status === "draft" || allocation.status === "adjusted");

  const remainingDiscretionary =
    allocation?.status === "approved" && safe != null
      ? Math.max(0, safe - spentMtd)
      : null;
  const pctUsed =
    allocation?.status === "approved" && safe != null && safe > 0
      ? Math.min(100, (spentMtd / safe) * 100)
      : null;

  const grouped = useMemo(() => {
    const order: ItemRow["category"][] = ["obligation", "goal", "spending"];
    const map = new Map<ItemRow["category"], ItemRow[]>();
    for (const c of order) map.set(c, []);
    for (const it of items) {
      map.get(it.category)?.push(it);
    }
    return order.map((c) => ({ category: c, label: groupLabel(c), rows: map.get(c) ?? [] }));
  }, [items]);

  function handleApprove() {
    if (!allocation) return;
    setError(null);
    const adjustments = items
      .map((i) => {
        const raw = amounts[i.id];
        const n = parseFloat(raw?.replace(/,/g, "") ?? "");
        if (Number.isNaN(n) || n < 0) return null;
        if (Math.abs(n - i.amount) < 0.0001) return null;
        return { itemId: i.id, newAmount: n };
      })
      .filter(Boolean) as Array<{ itemId: string; newAmount: number }>;

    startTransition(async () => {
      const res = await approveAllocationAction(
        allocation.id,
        adjustments.length > 0 ? adjustments : undefined
      );
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-8 pb-10 animate-fade-in max-w-4xl">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Allocation</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monthly plan from income minus obligations and goals. Approve to use safe-to-spend across the app.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href={`/allocation?month=${prevMonth}`} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <span className="text-sm font-medium min-w-[10rem] text-center tabular-nums">{monthTitle}</span>
          <Button variant="outline" size="icon" asChild>
            <Link href={`/allocation?month=${nextMonth}`} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Budget Overview — always shown */}
      <BudgetOverview
        summary={budgetSummary}
        period={period}
        onPeriodChange={setPeriod}
        currency={displayCurrency}
      />

      {/* Allocation plan — only shown when one exists */}
      {!allocation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No plan for this month</CardTitle>
            <CardDescription>
              A draft allocation is created when a <strong>salary</strong> income transaction is recorded and the
              payday workflow runs. Log salary under{" "}
              <Link href="/transactions" className="text-primary underline-offset-4 hover:underline">
                Transactions
              </Link>
              . Manual and windfall triggers exist in the data model but are not generated in the app yet.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {allocation && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={allocation.status === "approved" ? "default" : "secondary"}>
              {allocation.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Trigger: {allocation.trigger_type}
              {allocation.approved_at && (
                <> · Approved {format(new Date(allocation.approved_at), "MMM d, yyyy HH:mm")}</>
              )}
            </span>
          </div>

          {allocation.status !== "approved" && (
            <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/40 px-3 py-2">
              Safe-to-spend and related tools typically require an <strong>approved</strong> plan. Review the lines
              below, adjust amounts if needed, then approve.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="md:col-span-2 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Income received</p>
                  <p className="font-display text-xl font-bold mt-1 tabular-nums">
                    {formatCurrency(allocation.total_income_received ?? 0, displayCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Obligations</p>
                  <p className="font-display text-xl font-bold mt-1 tabular-nums">
                    {formatCurrency(allocation.total_obligations ?? 0, displayCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Goals</p>
                  <p className="font-display text-xl font-bold mt-1 tabular-nums">
                    {formatCurrency(allocation.total_goals ?? 0, displayCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Safe to spend</p>
                  <p className="font-display text-2xl font-bold mt-1 text-primary tabular-nums">
                    {formatCurrency(safe ?? 0, displayCurrency)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">If you spread safe-to-spend evenly</CardTitle>
                <CardDescription>
                  Derived from this month&apos;s plan only — not separate stored budgets.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Weekly</span>
                  <span className="font-medium tabular-nums">{formatCurrency(splits.weekly, displayCurrency)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Bi-weekly</span>
                  <span className="font-medium tabular-nums">{formatCurrency(splits.biWeekly, displayCurrency)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Monthly</span>
                  <span className="font-medium tabular-nums">{formatCurrency(splits.monthly, displayCurrency)}</span>
                </div>
                <Separator />
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Quarterly (3× monthly)</span>
                  <span className="font-medium tabular-nums">{formatCurrency(splits.quarterly, displayCurrency)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Yearly (12× monthly)</span>
                  <span className="font-medium tabular-nums">{formatCurrency(splits.yearly, displayCurrency)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cash on hand</CardTitle>
                <CardDescription>Sum of active account balances — informational only.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-display text-2xl font-bold tabular-nums">
                  {formatCurrency(accountsTotal, displayCurrency)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Does not change the stored safe-to-spend figure.
                </p>
              </CardContent>
            </Card>
          </div>

          {allocation.status === "approved" && safe != null && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Discretionary progress (this month)</CardTitle>
                <CardDescription>
                  Spending through {todayStr} vs planned safe-to-spend (expenses + card charges).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Spent</span>
                  <span className="font-semibold tabular-nums text-destructive">
                    {formatCurrency(spentMtd, displayCurrency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-semibold tabular-nums text-success-600">
                    {formatCurrency(remainingDiscretionary ?? 0, displayCurrency)}
                  </span>
                </div>
                {pctUsed != null && (
                  <>
                    <Progress value={pctUsed} className="h-2" />
                    <p className="text-xs text-muted-foreground">{pctUsed.toFixed(0)}% of planned used</p>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-6">
            {grouped.map(
              ({ category, label, rows }) =>
                rows.length > 0 && (
                  <Card key={category}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{label}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {rows.map((item) => {
                        const link = itemResourceLink(item);
                        return (
                          <div
                            key={item.id}
                            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm">{item.label}</p>
                              <p className="text-xs text-muted-foreground">Priority {item.priority}</p>
                              {link && (
                                <Link
                                  href={link.href}
                                  className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
                                >
                                  {link.label}
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {canApprove ? (
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  className="w-32 tabular-nums text-right"
                                  value={amounts[item.id] ?? ""}
                                  onChange={(e) =>
                                    setAmounts((prev) => ({ ...prev, [item.id]: e.target.value }))
                                  }
                                  aria-label={`Amount for ${item.label}`}
                                />
                              ) : (
                                <span className="font-semibold tabular-nums">
                                  {formatCurrency(item.amount, displayCurrency)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )
            )}
          </div>

          {canApprove && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button onClick={handleApprove} disabled={pending}>
                {pending ? "Approving…" : "Approve plan"}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
