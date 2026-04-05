"use client";

import React, { useState } from "react";
import {
  formatCurrency,
  formatDate,
  TX_TYPE_LABELS,
  TX_TYPE_COLORS,
  cn,
} from "@/lib/utils";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format, differenceInDays, parseISO } from "date-fns";
import type { Database } from "@/types/database";
import type { BudgetSummary } from "../allocation/page";
import { Plus, Receipt, ArrowRight, AlertTriangle, Wallet, CalendarClock } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { TransactionForm } from "@/app/(app)/transactions/transactions-client";
import { ExpenseForm } from "@/app/(app)/expenses/expenses-client";

type Account = Pick<
  Database["public"]["Tables"]["accounts"]["Row"],
  "id" | "name" | "currency_code" | "type"
>;
type CreditCard = Pick<
  Database["public"]["Tables"]["credit_cards"]["Row"],
  "id" | "name" | "last_four" | "currency_code"
>;
type Transaction = Database["public"]["Tables"]["transactions"]["Row"] & {
  category?: { name: string; color: string } | null;
  merchant?: { name: string } | null;
};
type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
type Allocation = Database["public"]["Tables"]["monthly_allocations"]["Row"] & {
  items?: Database["public"]["Tables"]["allocation_items"]["Row"][];
};
type InstalmentPlan = Database["public"]["Tables"]["instalment_plans"]["Row"] & {
  credit_card?: { name: string } | null;
};

type CategoryForm = { id: string; name: string; color: string | null; type: string };
type MerchantForm = { id: string; name: string };

interface DebtProgressRow {
  id: string;
  name: string;
  original_amount: number;
  current_balance: number;
  monthly_payment: number | null;
  payment_due_day: number | null;
  paidTowardLoan: number;
  progressPct: number;
}

interface Props {
  accounts: Account[];
  creditCards: CreditCard[];
  recentTransactions: Transaction[];
  activeSubscriptions: Subscription[];
  displayName: string;
  allocation: Allocation | null;
  upcomingDueDates: Array<{
    due_date: string;
    statement_balance: number;
    minimum_payment: number | null;
    credit_card?: { name: string } | null;
  }>;
  categories: Array<{ id: string; name: string; color: string | null; budget_amount: number | null }>;
  spendByCategory: Record<string, number>;
  monthlyIncome: number;
  monthlyExpenses: number;
  weekIncome: number;
  weekSpend: number;
  topMerchants: { name: string; amount: number }[];
  merchants: MerchantForm[];
  categoriesForForms: CategoryForm[];
  totalCategoryBudget: number;
  weeklyBudgetPortion: number;
  instalmentPlans: InstalmentPlan[];
  debtsProgress: DebtProgressRow[];
  budgetSummary: BudgetSummary;
}

function nextMonthlyCalendarDay(dayOfMonth: number, from: Date): Date {
  let y = from.getFullYear();
  let m = from.getMonth();
  let candidate = new Date(y, m, dayOfMonth);
  const startOfFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (candidate < startOfFrom) {
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    candidate = new Date(y, m, dayOfMonth);
  }
  return candidate;
}

function nextInstalmentDue(startMonth: string): Date {
  const start = parseISO(startMonth.length <= 10 ? `${startMonth}T12:00:00` : startMonth);
  const day = start.getDate();
  return nextMonthlyCalendarDay(day, new Date());
}

export function DashboardClient({
  accounts,
  creditCards,
  recentTransactions,
  activeSubscriptions,
  displayName,
  allocation,
  upcomingDueDates,
  categories,
  spendByCategory,
  monthlyIncome,
  monthlyExpenses,
  weekIncome,
  weekSpend,
  topMerchants,
  merchants,
  categoriesForForms,
  totalCategoryBudget,
  weeklyBudgetPortion,
  instalmentPlans,
  debtsProgress,
  budgetSummary,
}: Props) {
  const displayCurrency = useDisplayCurrency();
  const today = new Date();
  const [txSheetOpen, setTxSheetOpen] = useState(false);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);

  const safeToSpend = allocation?.safe_to_spend ?? null;

  const monthRemainingBudget =
    totalCategoryBudget > 0 ? Math.max(0, totalCategoryBudget - monthlyExpenses) : null;
  const weekRemainingBudget =
    weeklyBudgetPortion > 0 ? Math.max(0, weeklyBudgetPortion - weekSpend) : null;

  const WEEKS_PER_MONTH = 4.345;
  const budgetLeft = budgetSummary.avgMonthlyIncome - budgetSummary.outflows.total;
  const budgetLeftWeekly = budgetLeft / WEEKS_PER_MONTH;
  const outflowPct =
    budgetSummary.avgMonthlyIncome > 0
      ? Math.min(100, (budgetSummary.outflows.total / budgetSummary.avgMonthlyIncome) * 100)
      : 0;
  const budgetLeftColor =
    budgetSummary.avgMonthlyIncome === 0
      ? "text-muted-foreground"
      : budgetLeft < 0
      ? "text-destructive"
      : budgetLeft / budgetSummary.avgMonthlyIncome < 0.2
      ? "text-warning-700"
      : "text-emerald-600";

  const monthlyNet = monthlyIncome - monthlyExpenses;
  const weeklyNet = weekIncome - weekSpend;

  const overdueStatements = upcomingDueDates.filter(
    (s) => differenceInDays(parseISO(s.due_date), today) < 0
  );

  const upcomingSubs = activeSubscriptions.filter((s) => {
    const days = differenceInDays(parseISO(s.next_billing_date), today);
    return days >= 0 && days <= 30;
  });

  const instalmentUpcoming = instalmentPlans
    .map((ip) => {
      const nextDue = nextInstalmentDue(ip.start_month);
      const start = parseISO(ip.start_month.length <= 10 ? `${ip.start_month}T12:00:00` : ip.start_month);
      const monthsElapsed = Math.max(
        0,
        (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth())
      );
      const monthsRemaining = Math.max(0, ip.months - monthsElapsed);
      if (monthsRemaining <= 0) return null;
      const daysUntil = differenceInDays(nextDue, today);
      if (daysUntil > 30) return null;
      return {
        id: ip.id,
        label: ip.description,
        sublabel: (ip.credit_card as { name: string } | null)?.name ?? "Card",
        amount: ip.monthly_amount,
        daysUntil,
        dueDate: nextDue,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      label: string;
      sublabel: string;
      amount: number;
      daysUntil: number;
      dueDate: Date;
    }>;

  const debtUpcoming = debtsProgress
    .filter((d) => d.monthly_payment && d.monthly_payment > 0 && d.payment_due_day)
    .map((d) => {
      const nextDue = nextMonthlyCalendarDay(d.payment_due_day!, today);
      const daysUntil = differenceInDays(nextDue, today);
      if (daysUntil > 30) return null;
      return {
        id: d.id,
        label: d.name,
        sublabel: "Loan payment",
        amount: d.monthly_payment!,
        daysUntil,
        dueDate: nextDue,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      label: string;
      sublabel: string;
      amount: number;
      daysUntil: number;
      dueDate: Date;
    }>;

  const categoryBudgetData = categories
    .filter((c) => c.budget_amount && c.budget_amount > 0)
    .map((c) => ({
      name: c.name,
      budget: c.budget_amount ?? 0,
      spent: spendByCategory[c.id] ?? 0,
      colour: c.color ?? "#e8e0cc",
    }))
    .slice(0, 8);

  return (
    <div className="space-y-6 pb-8 animate-fade-in">
      {overdueStatements.length > 0 && (
        <div className="alert-banner rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning-700 shrink-0 mt-0.5" />
          <p className="text-sm text-primary font-medium">
            {overdueStatements.length} credit card payment(s) overdue — review upcoming payments below.
          </p>
        </div>
      )}

      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">
          Good{" "}
          {today.getHours() < 12 ? "morning" : today.getHours() < 17 ? "afternoon" : "evening"},{" "}
          {displayName || "there"}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">{format(today, "EEEE, MMMM d, yyyy")}</p>
      </div>

      {/* Budget + quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Remaining budget
            </CardTitle>
            <CardDescription>
              Expected income minus fixed outflows (debts, cards, instalments, subscriptions,
              savings).{" "}
              <Link href="/allocation" className="text-primary underline-offset-4 hover:underline">
                Full breakdown →
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Monthly / Weekly panels */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Budget left · this month
                </p>
                {budgetSummary.avgMonthlyIncome > 0 ? (
                  <>
                    <p className={cn("font-display text-3xl font-bold mt-1 tabular-nums", budgetLeftColor)}>
                      {formatCurrency(budgetLeft, displayCurrency)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      expected {formatCurrency(budgetSummary.avgMonthlyIncome, displayCurrency)} −
                      outflows {formatCurrency(budgetSummary.outflows.total, displayCurrency)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">
                    Add your income in{" "}
                    <Link href="/profile" className="text-primary underline-offset-4 hover:underline">
                      Financial Health
                    </Link>{" "}
                    to see budget left.
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Budget left · this week
                </p>
                {budgetSummary.avgMonthlyIncome > 0 ? (
                  <>
                    <p className={cn("font-display text-3xl font-bold mt-1 tabular-nums", budgetLeftColor)}>
                      {formatCurrency(budgetLeftWeekly, displayCurrency)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      monthly ÷ 4.35 · received this month{" "}
                      {formatCurrency(budgetSummary.actualIncomeThisMonth, displayCurrency)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">
                    Weekly slice shows once income is set.
                  </p>
                )}
              </div>
            </div>

            {/* Outflow commitment bar */}
            {budgetSummary.avgMonthlyIncome > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Fixed commitments</span>
                  <span>{outflowPct.toFixed(0)}% of income</span>
                </div>
                <Progress value={outflowPct} className="h-2" />
                <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                  {budgetSummary.outflowCounts.debts > 0 && (
                    <span>Debts ({budgetSummary.outflowCounts.debts}): {formatCurrency(budgetSummary.outflows.debts, displayCurrency)}</span>
                  )}
                  {budgetSummary.outflowCounts.creditCards > 0 && (
                    <span>Cards ({budgetSummary.outflowCounts.creditCards}): {formatCurrency(budgetSummary.outflows.creditCards, displayCurrency)}</span>
                  )}
                  {budgetSummary.outflowCounts.instalments > 0 && (
                    <span>Instalments ({budgetSummary.outflowCounts.instalments}): {formatCurrency(budgetSummary.outflows.instalments, displayCurrency)}</span>
                  )}
                  {budgetSummary.outflowCounts.subscriptions > 0 && (
                    <span>Subs ({budgetSummary.outflowCounts.subscriptions}): {formatCurrency(budgetSummary.outflows.subscriptions, displayCurrency)}</span>
                  )}
                  {budgetSummary.outflowCounts.savings > 0 && (
                    <span>Savings ({budgetSummary.outflowCounts.savings}): {formatCurrency(budgetSummary.outflows.savings, displayCurrency)}</span>
                  )}
                </div>
              </div>
            )}

            {safeToSpend !== null && (
              <p className="text-xs text-muted-foreground pt-3 border-t border-border">
                Allocation <span className="font-semibold text-foreground">Safe to spend</span>:{" "}
                {formatCurrency(safeToSpend, displayCurrency)}
                {allocation && (
                  <>
                    {" "}·{" "}
                    <Link href="/allocation" className="text-primary underline-offset-4 hover:underline">
                      View plan
                    </Link>
                  </>
                )}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick add</CardTitle>
            <CardDescription>Log spending without leaving the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button className="w-full justify-center gap-2" onClick={() => setExpenseSheetOpen(true)}>
              <Receipt className="h-4 w-4" />
              Add expense
            </Button>
            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              onClick={() => setTxSheetOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add transaction
            </Button>
            <Link href="/transactions" className="text-xs text-center text-muted-foreground hover:text-foreground pt-1">
              Full transactions page
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Recent transactions</CardTitle>
                <Link href="/transactions">
                  <Button variant="ghost" size="sm" className="text-xs">
                    View all <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No transactions yet</p>
              ) : (
                recentTransactions.map((tx) => {
                  const colours = TX_TYPE_COLORS[tx.type];
                  const isIncome = tx.type === "income";
                  const isExpense = ["expense", "credit_charge"].includes(tx.type);
                  return (
                    <div key={tx.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                          colours.bg,
                          colours.text
                        )}
                      >
                        {TX_TYPE_LABELS[tx.type]?.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tx.merchant?.name ?? tx.description ?? TX_TYPE_LABELS[tx.type]}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">{formatDate(tx.date, "MMM d")}</span>
                          {tx.category && (
                            <>
                              <span className="text-muted-foreground text-xs">·</span>
                              <span className="text-xs" style={{ color: tx.category.color ?? undefined }}>
                                {tx.category.name}
                              </span>
                            </>
                          )}
                          {tx.income_type && (
                            <Badge variant="outline" className="text-xs py-0 h-4">
                              {tx.income_type}
                            </Badge>
                          )}
                          {!tx.is_collected && (
                            <Badge variant="secondary" className="text-xs py-0 h-4">
                              uncollected
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "font-semibold text-sm shrink-0 tabular-nums",
                          isIncome ? "text-success-600" : isExpense ? "text-destructive" : "text-foreground"
                        )}
                      >
                        {isExpense ? "-" : isIncome ? "+" : ""}
                        {formatCurrency(tx.amount, displayCurrency)}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Monthly summary</CardTitle>
                <CardDescription>{format(today, "MMMM yyyy")} (month to date)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Income</span>
                  <span className="font-semibold text-success-600 tabular-nums">
                    +{formatCurrency(monthlyIncome, displayCurrency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expenses</span>
                  <span className="font-semibold text-destructive tabular-nums">
                    −{formatCurrency(monthlyExpenses, displayCurrency)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="font-medium">Net</span>
                  <span
                    className={cn(
                      "font-bold tabular-nums",
                      monthlyNet >= 0 ? "text-success-600" : "text-destructive"
                    )}
                  >
                    {formatCurrency(monthlyNet, displayCurrency)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Weekly summary</CardTitle>
                <CardDescription>Monday through today</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Income</span>
                  <span className="font-semibold text-success-600 tabular-nums">
                    +{formatCurrency(weekIncome, displayCurrency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expenses</span>
                  <span className="font-semibold text-destructive tabular-nums">
                    −{formatCurrency(weekSpend, displayCurrency)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="font-medium">Net</span>
                  <span
                    className={cn(
                      "font-bold tabular-nums",
                      weeklyNet >= 0 ? "text-success-600" : "text-destructive"
                    )}
                  >
                    {formatCurrency(weeklyNet, displayCurrency)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top merchants</CardTitle>
              <CardDescription>This month by spend</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {topMerchants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No merchant-tagged spending this month.</p>
              ) : (
                topMerchants.map((m, i) => (
                  <div key={`${m.name}-${i}`} className="flex items-center justify-between text-sm gap-2">
                    <span className="truncate font-medium">{m.name}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      {formatCurrency(m.amount, displayCurrency)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  Upcoming (30 days)
                </CardTitle>
              </div>
              <CardDescription>Cards, subscriptions, instalments, loan payments</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border space-y-0">
              {upcomingDueDates.slice(0, 6).map((s, i) => {
                const days = differenceInDays(parseISO(s.due_date), today);
                return (
                  <div key={`st-${i}`} className="flex items-center gap-3 py-2.5 first:pt-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {(s.credit_card as { name: string } | null)?.name ?? "Card"} · Statement
                      </p>
                      <p className="text-xs text-muted-foreground">Due {formatDate(s.due_date)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(s.minimum_payment ?? s.statement_balance, displayCurrency)}
                      </p>
                      <p
                        className={cn(
                          "text-xs",
                          days < 0 ? "text-destructive" : days <= 3 ? "text-destructive" : "text-muted-foreground"
                        )}
                      >
                        {days < 0 ? "Overdue" : days === 0 ? "Today" : `in ${days}d`}
                      </p>
                    </div>
                  </div>
                );
              })}

              {upcomingSubs.map((sub) => {
                const days = differenceInDays(parseISO(sub.next_billing_date), today);
                return (
                  <div key={sub.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{sub.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {sub.provider ?? sub.billing_cycle} · subscription
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(sub.amount, displayCurrency)}
                      </p>
                      <p className="text-xs text-muted-foreground">{days === 0 ? "Today" : `in ${days}d`}</p>
                    </div>
                  </div>
                );
              })}

              {instalmentUpcoming.map((row) => (
                <div key={row.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.sublabel} · instalment</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(row.amount, displayCurrency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.daysUntil < 0
                        ? "Overdue"
                        : row.daysUntil === 0
                          ? "Today"
                          : `in ${row.daysUntil}d`}
                    </p>
                  </div>
                </div>
              ))}

              {debtUpcoming.map((row) => (
                <div key={row.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.sublabel}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(row.amount, displayCurrency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.daysUntil < 0
                        ? "Overdue"
                        : row.daysUntil === 0
                          ? "Today"
                          : `in ${row.daysUntil}d`}
                    </p>
                  </div>
                </div>
              ))}

              {upcomingDueDates.length === 0 &&
                upcomingSubs.length === 0 &&
                instalmentUpcoming.length === 0 &&
                debtUpcoming.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">No payments due in the next 30 days.</p>
                )}
            </CardContent>
          </Card>

          {categoryBudgetData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Spend vs budget</CardTitle>
                <CardDescription>This month by category</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryBudgetData.map((cat) => {
                  const pct = Math.min((cat.spent / cat.budget) * 100, 100);
                  const over = cat.spent > cat.budget;
                  return (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{cat.name}</span>
                        <span className={cn("text-xs", over ? "text-destructive" : "text-muted-foreground")}>
                          {formatCurrency(cat.spent, displayCurrency)} / {formatCurrency(cat.budget, displayCurrency)}
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className="h-1.5"
                        indicatorClassName={over ? "bg-destructive" : pct > 70 ? "bg-warning" : "bg-success"}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {debtsProgress.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Loan progress</CardTitle>
                  <Link href="/debts">
                    <Button variant="ghost" size="sm" className="text-xs">
                      Details
                    </Button>
                  </Link>
                </div>
                <CardDescription>Paid toward original balance — not a total-debt headline</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {debtsProgress.map((d) => (
                  <div key={d.id} className="space-y-2">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-medium truncate">{d.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {d.progressPct.toFixed(0)}% paid down
                      </span>
                    </div>
                    <Progress value={Math.min(d.progressPct, 100)} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Paid {formatCurrency(d.paidTowardLoan, displayCurrency)}</span>
                      <span>
                        Original {formatCurrency(d.original_amount, displayCurrency)} · Remaining{" "}
                        {formatCurrency(d.current_balance, displayCurrency)}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Sheet open={txSheetOpen} onOpenChange={setTxSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add transaction</SheetTitle>
            <SheetDescription>Income, transfer, card payment, or charge — same as the Transactions page.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <TransactionForm
              accounts={accounts}
              categories={categoriesForForms}
              merchants={merchants}
              creditCards={creditCards}
              onSuccess={() => setTxSheetOpen(false)}
              onClose={() => setTxSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={expenseSheetOpen} onOpenChange={setExpenseSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add expense</SheetTitle>
            <SheetDescription>Quick expense entry with category and merchant.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <ExpenseForm
              key={expenseSheetOpen ? "open" : "closed"}
              categories={categoriesForForms.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
              merchants={merchants}
              accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency_code: a.currency_code }))}
              creditCards={creditCards.map((c) => ({
                id: c.id,
                name: c.name,
                last_four: c.last_four,
                currency_code: c.currency_code,
              }))}
              onSuccess={() => setExpenseSheetOpen(false)}
              onClose={() => setExpenseSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
