"use client";

import React, { useMemo } from "react";
import { formatCurrency, formatDate, utilColour, TX_TYPE_LABELS, TX_TYPE_COLORS, cn, getCurrencySymbol } from "@/lib/utils";
import { useDisplayCurrency } from "@/components/providers/display-currency-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  AlertTriangle, TrendingUp, TrendingDown, Wallet, CreditCard, PiggyBank, Calendar, ArrowRight, RefreshCcw, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format, differenceInDays, parseISO } from "date-fns";
import type { Database } from "@/types/database";

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type CreditCard = Database["public"]["Tables"]["credit_cards"]["Row"] & { outstanding_balance: number };
type Transaction = Database["public"]["Tables"]["transactions"]["Row"] & {
  category?: { name: string; color: string } | null;
  merchant?: { name: string } | null;
};
type SavingsPlan = Database["public"]["Tables"]["savings_plans"]["Row"];
type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
type Debt = Database["public"]["Tables"]["debts"]["Row"];
type HealthSnapshot = Database["public"]["Tables"]["financial_health_snapshots"]["Row"];
type Allocation = Database["public"]["Tables"]["monthly_allocations"]["Row"] & {
  items?: Database["public"]["Tables"]["allocation_items"]["Row"][];
};

interface Props {
  accounts: Account[];
  creditCards: CreditCard[];
  recentTransactions: Transaction[];
  savingsPlans: SavingsPlan[];
  activeSubscriptions: Subscription[];
  activeDebts: Debt[];
  healthSnapshot: HealthSnapshot | null;
  displayName: string;
  allocation: Allocation | null;
  upcomingDueDates: Array<{ due_date: string; statement_balance: number; minimum_payment: number | null; credit_card?: { name: string } | null }>;
  categories: Array<{ id: string; name: string; color: string | null; budget_amount: number | null }>;
  spendByCategory: Record<string, number>;
  cashFlowData: Record<string, { salary: number; freelance: number; expenses: number }>;
  monthlyIncome: number;
}

function HealthChip({ label, value, colour }: { label: string; value: string; colour: "green" | "amber" | "red" }) {
  const colours = {
    green: "bg-success/10 text-success-600 border-success/20",
    amber: "bg-warning/10 text-warning-700 border-warning/20",
    red: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <div className={cn("flex flex-col items-center px-4 py-2.5 rounded-xl border text-center min-w-0", colours[colour])}>
      <span className="text-xs font-medium opacity-80 whitespace-nowrap">{label}</span>
      <span className="font-semibold text-sm mt-0.5 whitespace-nowrap">{value}</span>
    </div>
  );
}

function CircularProgress({ pct, size = 80, colour = "green" }: { pct: number; size?: number; colour?: "green" | "amber" | "red" }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const colours = { green: "#28c095", amber: "#cea843", red: "#ef4444" };

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8e0cc" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={colours[colour]} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

export function DashboardClient({
  accounts, creditCards, recentTransactions, savingsPlans, activeSubscriptions,
  activeDebts, healthSnapshot, displayName, allocation,
  upcomingDueDates, categories, spendByCategory, cashFlowData, monthlyIncome,
}: Props) {
  const displayCurrency = useDisplayCurrency();
  const sym = getCurrencySymbol(displayCurrency);
  const today = new Date();

  // Compute totals
  const totalAccountBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalDebt = activeDebts.reduce((s, d) => s + d.current_balance, 0)
    + creditCards.reduce((s, c) => s + Math.max(0, c.outstanding_balance), 0);
  const netWorth = healthSnapshot?.net_worth ?? (totalAccountBalance - totalDebt);

  // Alerts
  const alerts: string[] = [];
  const overdueCards = upcomingDueDates.filter((s) => differenceInDays(parseISO(s.due_date), today) < 0);
  if (overdueCards.length > 0) alerts.push(`${overdueCards.length} credit card payment(s) overdue`);

  const highUtilCards = creditCards.filter((c) => c.credit_limit > 0 && (c.outstanding_balance / c.credit_limit) > 0.7);
  if (highUtilCards.length > 0) alerts.push(`${highUtilCards.length} card(s) above 70% utilisation`);

  const buffer = healthSnapshot?.freelance_buffer_months ?? 0;
  if (buffer < 1.5 && buffer > 0) alerts.push(`Freelance buffer low: ${buffer.toFixed(1)} months (target 3)`);

  const behindPlans = savingsPlans.filter((p) => p.target_date && p.current_amount < p.target_amount);
  if (behindPlans.length > 0) alerts.push(`${behindPlans.length} savings goal(s) need attention`);

  // Cash flow chart data
  const cashFlowChartData = Object.entries(cashFlowData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month: format(parseISO(`${month}-01`), "MMM yy"),
      salary: data.salary,
      freelance: data.freelance,
      expenses: data.expenses,
    }));

  // Category spend vs budget
  const categoryBudgetData = categories
    .filter((c) => c.budget_amount && c.budget_amount > 0)
    .map((c) => ({
      name: c.name,
      budget: c.budget_amount ?? 0,
      spent: spendByCategory[c.id] ?? 0,
      colour: c.color ?? "#e8e0cc",
    }))
    .slice(0, 8);

  // This month income vs expenses
  const monthlyExpenses = Object.values(spendByCategory).reduce((s, v) => s + v, 0);
  const monthlyNet = monthlyIncome - monthlyExpenses;

  // Monthly subscription cost (normalised to per-month equivalent)
  const monthlySubTotal = activeSubscriptions.reduce((s, sub) => {
    const monthly =
      sub.billing_cycle === "weekly" ? sub.amount * 4.33
      : sub.billing_cycle === "quarterly" ? sub.amount / 3
      : sub.billing_cycle === "yearly" ? sub.amount / 12
      : sub.amount;
    return s + monthly;
  }, 0);

  // Upcoming (next 30 days for subscriptions)
  const upcomingSubs = activeSubscriptions.filter((s) => {
    const days = differenceInDays(parseISO(s.next_billing_date), today);
    return days >= 0 && days <= 30;
  });

  const safeToSpend = allocation?.safe_to_spend ?? healthSnapshot?.safe_to_spend ?? null;

  const bufferColour = buffer >= 3 ? "green" : buffer >= 1.5 ? "amber" : "red";
  const dtiRatio = healthSnapshot?.debt_to_income_ratio ?? 0;
  const dtiColour = dtiRatio < 0.3 ? "green" : dtiRatio < 0.4 ? "amber" : "red";
  const aggUtil = healthSnapshot?.aggregate_credit_utilisation ?? 0;
  const utilColor = utilColour(aggUtil * 100);

  return (
    <div className="space-y-6 pb-8 animate-fade-in">
      {/* Alert banner */}
      {alerts.length > 0 && (
        <div className="alert-banner rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {alerts.map((alert, i) => (
              <p key={i} className="text-sm text-primary font-medium">{alert}</p>
            ))}
          </div>
        </div>
      )}

      {/* Greeting + health strip */}
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">
          Good {today.getHours() < 12 ? "morning" : today.getHours() < 17 ? "afternoon" : "evening"}, {displayName || "there"} 👋
        </h2>
        <p className="text-muted-foreground text-sm mt-1">{format(today, "EEEE, MMMM d, yyyy")}</p>

        <div className="flex gap-3 mt-4 overflow-x-auto pb-1 no-scrollbar">
          <HealthChip label="Net Worth" value={formatCurrency(netWorth, displayCurrency)} colour={netWorth >= 0 ? "green" : "red"} />
          {safeToSpend !== null && (
            <HealthChip label="Safe to Spend" value={formatCurrency(safeToSpend, displayCurrency)} colour={safeToSpend > 5000 ? "green" : safeToSpend > 0 ? "amber" : "red"} />
          )}
          <HealthChip label="Buffer" value={`${buffer.toFixed(1)} mo`} colour={bufferColour} />
          <HealthChip label="Debt/Income" value={`${(dtiRatio * 100).toFixed(0)}%`} colour={dtiColour} />
          <HealthChip label="Credit Util." value={`${(aggUtil * 100).toFixed(0)}%`} colour={utilColor} />
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Safe to Spend + Net Worth cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {safeToSpend !== null && (
              <Card className="bg-primary text-white border-0">
                <CardContent className="p-5">
                  <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Safe to Spend</p>
                  <p className="font-display text-3xl font-bold mt-1 text-white">
                    {formatCurrency(safeToSpend, displayCurrency)}
                  </p>
                  <p className="text-white/60 text-xs mt-2">Remaining this month</p>
                  {allocation && (
                    <Link href="/profile" className="text-accent-DEFAULT text-xs mt-3 flex items-center gap-1 hover:underline">
                      View allocation plan <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-5">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Net Worth</p>
                <p className={cn("font-display text-3xl font-bold mt-1", netWorth >= 0 ? "text-success-600" : "text-destructive")}>
                  {formatCurrency(netWorth, displayCurrency)}
                </p>
                <p className="text-muted-foreground text-xs mt-2">Assets minus liabilities</p>
                <div className="flex items-center gap-1 mt-3">
                  {netWorth >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(totalAccountBalance, displayCurrency)} assets · {formatCurrency(totalDebt, displayCurrency)} debt
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* This Month Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">This Month — {format(today, "MMMM yyyy")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Income</p>
                  <p className="text-xl font-bold text-success-600 mt-1">
                    +{formatCurrency(monthlyIncome, displayCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Expenses</p>
                  <p className="text-xl font-bold text-destructive mt-1">
                    -{formatCurrency(monthlyExpenses, displayCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Net</p>
                  <p className={cn("text-xl font-bold mt-1", monthlyNet >= 0 ? "text-success-600" : "text-destructive")}>
                    {formatCurrency(monthlyNet, displayCurrency)}
                  </p>
                </div>
              </div>
              {monthlySubTotal > 0 && (
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                  <RefreshCcw className="h-3 w-3 inline mr-1 opacity-60" />
                  {formatCurrency(monthlySubTotal, displayCurrency)}/mo in recurring subscriptions ({activeSubscriptions.length} active)
                </p>
              )}
            </CardContent>
          </Card>

          {/* Cash flow chart */}
          {cashFlowChartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cash Flow — Last 6 Months</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={cashFlowChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#032e6d" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#032e6d" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="freGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#28c095" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#28c095" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e0cc" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${sym}${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v), displayCurrency)} />
                    <Legend iconType="circle" iconSize={8} />
                    <Area type="monotone" dataKey="salary" stroke="#032e6d" strokeWidth={2} fill="url(#salGrad)" name="Salary" />
                    <Area type="monotone" dataKey="freelance" stroke="#28c095" strokeWidth={2} fill="url(#freGrad)" name="Freelance" />
                    <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="none" strokeDasharray="4 2" name="Expenses" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Spend vs budget */}
          {categoryBudgetData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Monthly Spend vs Budget</CardTitle>
                <CardDescription>This month&apos;s expenses against your category budgets</CardDescription>
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

          {/* Recent transactions */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Transactions</CardTitle>
                <Link href="/transactions">
                  <Button variant="ghost" size="sm" className="text-xs">View all <ArrowRight className="h-3 w-3 ml-1" /></Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No transactions yet</p>
              ) : (
                recentTransactions.map((tx) => {
                  const colours = TX_TYPE_COLORS[tx.type];
                  const isIncome = tx.type === "income";
                  const isExpense = ["expense", "credit_charge"].includes(tx.type);
                  return (
                    <div key={tx.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0", colours.bg, colours.text)}>
                        {TX_TYPE_LABELS[tx.type]?.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tx.merchant?.name ?? tx.description ?? TX_TYPE_LABELS[tx.type]}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-muted-foreground">{formatDate(tx.date, "MMM d")}</span>
                          {tx.category && (
                            <>
                              <span className="text-muted-foreground text-xs">·</span>
                              <span className="text-xs" style={{ color: tx.category.color ?? undefined }}>{tx.category.name}</span>
                            </>
                          )}
                          {tx.income_type && (
                            <Badge variant="outline" className="text-xs py-0 h-4">
                              {tx.income_type}
                            </Badge>
                          )}
                          {!tx.is_collected && (
                            <Badge variant="secondary" className="text-xs py-0 h-4">uncollected</Badge>
                          )}
                        </div>
                      </div>
                      <span className={cn("font-semibold text-sm shrink-0", isIncome ? "text-success-600" : isExpense ? "text-destructive" : "text-foreground")}>
                        {isExpense ? "-" : isIncome ? "+" : ""}{formatCurrency(tx.amount, displayCurrency)}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — 1/3 width */}
        <div className="space-y-6">
          {/* Account balances */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Accounts</CardTitle>
                <Link href="/accounts">
                  <Button variant="ghost" size="sm" className="text-xs">Manage</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {accounts.slice(0, 5).map((acc) => (
                <div key={acc.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: acc.color ?? "#032e6d" }} />
                    <span className="text-sm truncate">{acc.name}</span>
                  </div>
                  <span className={cn("text-sm font-semibold shrink-0", acc.balance >= 0 ? "text-foreground" : "text-destructive")}>
                    {formatCurrency(acc.balance, displayCurrency)}
                  </span>
                </div>
              ))}
              {accounts.length === 0 && (
                <p className="text-sm text-muted-foreground py-2 text-center">No accounts</p>
              )}
              <div className="flex items-center justify-between pt-2.5 font-semibold text-sm">
                <span>Total</span>
                <span>{formatCurrency(totalAccountBalance, displayCurrency)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Credit cards */}
          {creditCards.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Credit Cards</CardTitle>
                  <Link href="/credit-cards">
                    <Button variant="ghost" size="sm" className="text-xs">Manage</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {creditCards.slice(0, 3).map((card) => {
                  const util = card.credit_limit > 0 ? (card.outstanding_balance / card.credit_limit) * 100 : 0;
                  const colour = utilColour(util);
                  const barColour = colour === "green" ? "bg-success" : colour === "amber" ? "bg-warning" : "bg-destructive";
                  const daysUntilDue = card.payment_due_day
                    ? differenceInDays(new Date(today.getFullYear(), today.getMonth(), card.payment_due_day), today)
                    : null;

                  return (
                    <div key={card.id}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-medium">{card.name}</span>
                        <span className={cn("text-xs font-semibold", colour === "green" ? "text-success-600" : colour === "amber" ? "text-warning-700" : "text-destructive")}>
                          {util.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-500", barColour)} style={{ width: `${Math.min(util, 100)}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(card.outstanding_balance, displayCurrency)} / {formatCurrency(card.credit_limit, displayCurrency)}
                        </span>
                        {daysUntilDue !== null && (
                          <span className={cn("text-xs", daysUntilDue <= 3 ? "text-destructive font-medium" : daysUntilDue <= 7 ? "text-warning-700" : "text-muted-foreground")}>
                            Due in {daysUntilDue}d
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Savings progress */}
          {savingsPlans.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Savings Goals</CardTitle>
                  <Link href="/savings">
                    <Button variant="ghost" size="sm" className="text-xs">View all</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {savingsPlans.slice(0, 3).map((plan) => {
                  const pct = Math.min((plan.current_amount / plan.target_amount) * 100, 100);
                  return (
                    <div key={plan.id} className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <CircularProgress pct={pct} size={52} colour={pct >= 80 ? "green" : pct >= 40 ? "amber" : "red"} />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{plan.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(plan.current_amount, displayCurrency)} / {formatCurrency(plan.target_amount, displayCurrency)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Upcoming due dates */}
          {(upcomingDueDates.length > 0 || upcomingSubs.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Upcoming in 30 Days</CardTitle>
                  <Link href="/subscriptions">
                    <Button variant="ghost" size="sm" className="text-xs">Subscriptions</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {upcomingDueDates.slice(0, 4).map((s, i) => {
                  const days = differenceInDays(parseISO(s.due_date), today);
                  return (
                    <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0">
                      <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{(s.credit_card as { name: string } | null)?.name ?? "Card payment"}</p>
                        <p className="text-xs text-muted-foreground">Due {formatDate(s.due_date)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatCurrency(s.minimum_payment ?? s.statement_balance, displayCurrency)}</p>
                        <p className={cn("text-xs", days <= 3 ? "text-destructive" : days <= 7 ? "text-warning-700" : "text-muted-foreground")}>
                          {days === 0 ? "Today" : days < 0 ? "Overdue" : `in ${days}d`}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {upcomingSubs.map((sub) => {
                  const days = differenceInDays(parseISO(sub.next_billing_date), today);
                  return (
                    <div key={sub.id} className="flex items-center gap-3 py-2.5">
                      <RefreshCcw className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{sub.name}</p>
                        <p className="text-xs text-muted-foreground">{sub.provider ?? sub.billing_cycle}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatCurrency(sub.amount, displayCurrency)}</p>
                        <p className="text-xs text-muted-foreground">{days === 0 ? "Today" : `in ${days}d`}</p>
                      </div>
                    </div>
                  );
                })}
                {monthlySubTotal > 0 && (
                  <div className="pt-2.5 flex items-center justify-between text-xs text-muted-foreground border-t border-border">
                    <span>{activeSubscriptions.length} recurring · monthly equiv.</span>
                    <span className="font-semibold text-foreground">{formatCurrency(monthlySubTotal, displayCurrency)}/mo</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Debts overview */}
          {activeDebts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Debt Overview</CardTitle>
                  <Link href="/debts">
                    <Button variant="ghost" size="sm" className="text-xs">Manage</Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {activeDebts.slice(0, 4).map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[60%]">{d.name}</span>
                    <span className="font-semibold text-destructive">{formatCurrency(d.current_balance, displayCurrency)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex items-center justify-between font-semibold text-sm">
                  <span>Total debt</span>
                  <span className="text-destructive">{formatCurrency(totalDebt, displayCurrency)}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

