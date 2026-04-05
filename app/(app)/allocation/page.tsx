import { createClient } from "@/lib/supabase/server";
import { AllocationClient } from "./allocation-client";
import { format, parseISO, startOfMonth, endOfMonth, isValid, differenceInMonths } from "date-fns";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type AllocationWithItems = Database["public"]["Tables"]["monthly_allocations"]["Row"] & {
  items: Database["public"]["Tables"]["allocation_items"]["Row"][] | null;
};

export interface BudgetSummary {
  avgMonthlyIncome: number;
  actualIncomeThisMonth: number;
  outflows: {
    debts: number;
    creditCards: number;
    instalments: number;
    subscriptions: number;
    savings: number;
    total: number;
  };
  outflowCounts: {
    debts: number;
    creditCards: number;
    instalments: number;
    subscriptions: number;
    savings: number;
  };
}

function normalizeMonthParam(raw: string | undefined): string {
  const now = new Date();
  const fallback = format(startOfMonth(now), "yyyy-MM-dd");
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback;
  const d = parseISO(raw);
  if (!isValid(d)) return fallback;
  return format(startOfMonth(d), "yyyy-MM-dd");
}

function toMonthly(amount: number, billing_cycle: string): number {
  switch (billing_cycle) {
    case "weekly":     return amount * 4.345;
    case "monthly":    return amount;
    case "quarterly":  return amount / 3;
    case "yearly":     return amount / 12;
    default:           return amount;
  }
}

interface Props {
  searchParams: Promise<{ month?: string }>;
}

export default async function AllocationPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { month: rawMonth } = await searchParams;
  const monthStart = normalizeMonthParam(rawMonth);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const viewMonth = parseISO(`${monthStart}T12:00:00`);
  const currentMonthStart = startOfMonth(new Date());

  let spentMtd = 0;
  let spentRangeEnd = todayStr;

  if (viewMonth < currentMonthStart) {
    spentRangeEnd = format(endOfMonth(viewMonth), "yyyy-MM-dd");
  } else if (viewMonth > currentMonthStart) {
    spentMtd = 0;
    spentRangeEnd = monthStart;
  }

  // Core allocation + accounts + budget data — all in parallel
  const [
    { data: allocation },
    { data: accounts },
    { data: healthSnapshot },
    { data: incomeTxRows },
    { data: debts },
    { data: creditCards },
    { data: instalmentPlans },
    { data: subscriptions },
    { data: savingsPlans },
  ] = await Promise.all([
    supabase
      .from("monthly_allocations")
      .select("*, items:allocation_items(*)")
      .eq("user_id", user.id)
      .eq("month", monthStart)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("accounts")
      .select("balance")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("financial_health_snapshots")
      .select("avg_monthly_salary, avg_monthly_freelance")
      .eq("user_id", user.id)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", user.id)
      .eq("type", "income")
      .gte("date", monthStart)
      .lte("date", todayStr),
    supabase
      .from("debts")
      .select("monthly_payment")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("credit_cards")
      .select("id, min_payment_type, min_payment_value")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("instalment_plans")
      .select("monthly_amount, months, start_month"),
    supabase
      .from("subscriptions")
      .select("amount, billing_cycle")
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("savings_plans")
      .select("target_amount, current_amount, target_date")
      .eq("user_id", user.id)
      .eq("is_achieved", false),
  ]);

  // Fetch spending MTD
  if (!(viewMonth > currentMonthStart)) {
    const { data: spentRows } = await supabase
      .from("transactions")
      .select("amount, fee_amount")
      .eq("user_id", user.id)
      .in("type", ["expense", "credit_charge"])
      .gte("date", monthStart)
      .lte("date", spentRangeEnd);

    spentMtd = (spentRows ?? []).reduce((s, t) => s + t.amount + (t.fee_amount ?? 0), 0);
  }

  // Compute credit card outstanding balances from transactions
  const cardIds = (creditCards ?? []).map((c) => c.id);
  let ccBalanceMap: Record<string, number> = {};
  if (cardIds.length > 0) {
    const { data: ccTx } = await supabase
      .from("transactions")
      .select("credit_card_id, type, amount")
      .eq("user_id", user.id)
      .in("credit_card_id", cardIds)
      .in("type", ["credit_charge", "credit_payment"]);

    (ccTx ?? []).forEach((tx) => {
      const id = tx.credit_card_id!;
      if (!ccBalanceMap[id]) ccBalanceMap[id] = 0;
      if (tx.type === "credit_charge") ccBalanceMap[id] += tx.amount;
      else if (tx.type === "credit_payment") ccBalanceMap[id] -= tx.amount;
    });
  }

  // ── Compute BudgetSummary ──────────────────────────────────────────────────

  // Income
  const avgMonthlyIncome =
    (healthSnapshot?.avg_monthly_salary ?? 0) +
    (healthSnapshot?.avg_monthly_freelance ?? 0);
  const actualIncomeThisMonth = (incomeTxRows ?? []).reduce((s, t) => s + t.amount, 0);

  // Outflow: debts
  const activeDebts = (debts ?? []).filter((d) => (d.monthly_payment ?? 0) > 0);
  const debtOutflow = activeDebts.reduce((s, d) => s + (d.monthly_payment ?? 0), 0);

  // Outflow: credit card minimums
  const ccOutflow = (creditCards ?? []).reduce((s, c) => {
    const outstanding = Math.max(0, ccBalanceMap[c.id] ?? 0);
    if (!c.min_payment_value) return s;
    const mp =
      c.min_payment_type === "percentage"
        ? outstanding * (c.min_payment_value / 100)
        : Math.min(c.min_payment_value, outstanding || c.min_payment_value);
    return s + mp;
  }, 0);

  // Outflow: instalment plans (only those with remaining balance)
  const today = new Date();
  const activeInstalments = (instalmentPlans ?? []).filter((ip) => {
    const monthsElapsed = Math.max(
      0,
      Math.floor((today.getTime() - new Date(ip.start_month).getTime()) / (1000 * 60 * 60 * 24 * 30))
    );
    return ip.months - monthsElapsed > 0;
  });
  const instalmentOutflow = activeInstalments.reduce((s, ip) => s + ip.monthly_amount, 0);

  // Outflow: subscriptions (normalized to monthly)
  const subOutflow = (subscriptions ?? []).reduce(
    (s, sub) => s + toMonthly(sub.amount, sub.billing_cycle),
    0
  );

  // Outflow: savings plans (computed monthly contribution for plans with target_date)
  const activeSavings = (savingsPlans ?? []).filter(
    (sp) => sp.target_date && sp.target_amount > (sp.current_amount ?? 0)
  );
  const savingsOutflow = activeSavings.reduce((s, sp) => {
    const monthsLeft = Math.max(1, differenceInMonths(new Date(sp.target_date!), today));
    const remaining = sp.target_amount - (sp.current_amount ?? 0);
    return s + remaining / monthsLeft;
  }, 0);

  const totalOutflow = debtOutflow + ccOutflow + instalmentOutflow + subOutflow + savingsOutflow;

  const budgetSummary: BudgetSummary = {
    avgMonthlyIncome,
    actualIncomeThisMonth,
    outflows: {
      debts: debtOutflow,
      creditCards: ccOutflow,
      instalments: instalmentOutflow,
      subscriptions: subOutflow,
      savings: savingsOutflow,
      total: totalOutflow,
    },
    outflowCounts: {
      debts: activeDebts.length,
      creditCards: (creditCards ?? []).length,
      instalments: activeInstalments.length,
      subscriptions: (subscriptions ?? []).length,
      savings: activeSavings.length,
    },
  };

  // ── Existing allocation prep ───────────────────────────────────────────────
  const accountsTotal = (accounts ?? []).reduce((s, a) => s + a.balance, 0);
  const rawItems = (allocation as AllocationWithItems | null)?.items ?? [];
  const sortedItems = [...rawItems].sort((a, b) => a.priority - b.priority);
  const allocKey = allocation
    ? `${monthStart}-${allocation.updated_at ?? allocation.id}`
    : `${monthStart}-none`;

  return (
    <AllocationClient
      key={allocKey}
      monthStart={monthStart}
      allocation={allocation as AllocationWithItems | null}
      items={sortedItems}
      accountsTotal={accountsTotal}
      spentMtd={spentMtd}
      todayStr={todayStr}
      budgetSummary={budgetSummary}
    />
  );
}
