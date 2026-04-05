import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";
import { format, addDays, startOfWeek, differenceInMonths } from "date-fns";
import type { BudgetSummary } from "../allocation/page";

function toMonthly(amount: number, billing_cycle: string): number {
  switch (billing_cycle) {
    case "weekly":    return amount * 4.345;
    case "monthly":   return amount;
    case "quarterly": return amount / 3;
    case "yearly":    return amount / 12;
    default:          return amount;
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const thirtyDaysOut = format(addDays(now, 30), "yyyy-MM-dd");
  const currentMonthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const { data: creditCards } = await supabase
    .from("credit_cards")
    .select("id, name, last_four, currency_code")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("name");
  const cardIdList = (creditCards ?? []).map((c) => c.id);

  const [
    { data: accounts },
    { data: recentTxs },
    { data: activeSubscriptions },
    { data: activeDebts },
    { data: profile },
    { data: allocation },
    { data: statements },
    { data: categories },
    { data: monthlyTxs },
    { data: weekTxs },
    { data: merchants },
    { data: categoriesForForms },
    { data: instalmentPlans },
    { data: debtPaymentsAll },
    { data: healthSnapshot },
    { data: creditCardsBudget },
    { data: savingsPlans },
  ] = await Promise.all([
    supabase.from("accounts").select("id, name, currency_code, type").eq("user_id", user.id).eq("is_active", true).order("name"),
    supabase
      .from("transactions")
      .select("*, category:categories!transactions_category_id_fkey(name,color), merchant:merchants(name)")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("subscriptions").select("*").eq("user_id", user.id).eq("status", "active").order("next_billing_date").limit(20),
    supabase.from("debts").select("*").eq("user_id", user.id).eq("status", "active").order("name"),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase.from("monthly_allocations").select("*, items:allocation_items(*)").eq("user_id", user.id).eq("month", currentMonthStart).order("created_at", { ascending: false }).limit(1).single(),
    supabase
      .from("credit_card_statements")
      .select("*, credit_card:credit_cards(name, user_id)")
      .gte("due_date", today)
      .lte("due_date", thirtyDaysOut)
      .eq("is_paid", false)
      .order("due_date"),
    supabase.from("categories").select("id, name, color, budget_amount").eq("user_id", user.id),
    supabase
      .from("transactions")
      .select("amount, fee_amount, type, category_id, merchant_id, income_type, merchants(name)")
      .eq("user_id", user.id)
      .gte("date", currentMonthStart)
      .lte("date", today),
    supabase
      .from("transactions")
      .select("amount, fee_amount, type, category_id, merchant_id, income_type, merchants(name)")
      .eq("user_id", user.id)
      .gte("date", weekStart)
      .lte("date", today),
    supabase.from("merchants").select("id, name").eq("user_id", user.id).order("name"),
    supabase.from("categories").select("id, name, color, type").eq("user_id", user.id).order("name"),
    cardIdList.length > 0
      ? supabase
          .from("instalment_plans")
          .select("*, credit_card:credit_cards(name)")
          .in("credit_card_id", cardIdList)
          .order("start_month", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("debt_payments").select("debt_id, amount"),
    supabase
      .from("financial_health_snapshots")
      .select("avg_monthly_salary, avg_monthly_freelance")
      .eq("user_id", user.id)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("credit_cards")
      .select("id, min_payment_type, min_payment_value")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("savings_plans")
      .select("target_amount, current_amount, target_date")
      .eq("user_id", user.id)
      .eq("is_achieved", false),
  ]);

  // ── Compute BudgetSummary (same logic as allocation/page.tsx) ────────────────
  const ccBudgetIds = (creditCardsBudget ?? []).map((c) => c.id);
  let ccBalanceMap: Record<string, number> = {};
  if (ccBudgetIds.length > 0) {
    const { data: ccTx } = await supabase
      .from("transactions")
      .select("credit_card_id, type, amount")
      .eq("user_id", user.id)
      .in("credit_card_id", ccBudgetIds)
      .in("type", ["credit_charge", "credit_payment"]);
    (ccTx ?? []).forEach((tx) => {
      const id = tx.credit_card_id!;
      if (!ccBalanceMap[id]) ccBalanceMap[id] = 0;
      if (tx.type === "credit_charge") ccBalanceMap[id] += tx.amount;
      else if (tx.type === "credit_payment") ccBalanceMap[id] -= tx.amount;
    });
  }

  const avgMonthlyIncome =
    (healthSnapshot?.avg_monthly_salary ?? 0) + (healthSnapshot?.avg_monthly_freelance ?? 0);
  const actualIncomeThisMonth = (monthlyTxs ?? [])
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);

  const activeDebtsForBudget = (activeDebts ?? []).filter((d) => (d.monthly_payment ?? 0) > 0);
  const debtOutflow = activeDebtsForBudget.reduce((s, d) => s + (d.monthly_payment ?? 0), 0);

  const ccOutflow = (creditCardsBudget ?? []).reduce((s, c) => {
    const outstanding = Math.max(0, ccBalanceMap[c.id] ?? 0);
    if (!c.min_payment_value) return s;
    const mp =
      c.min_payment_type === "percentage"
        ? outstanding * (c.min_payment_value / 100)
        : Math.min(c.min_payment_value, outstanding || c.min_payment_value);
    return s + mp;
  }, 0);

  const today2 = new Date();
  const activeInstalments = (instalmentPlans ?? []).filter((ip) => {
    const monthsElapsed = Math.max(
      0,
      Math.floor((today2.getTime() - new Date(ip.start_month).getTime()) / (1000 * 60 * 60 * 24 * 30))
    );
    return ip.months - monthsElapsed > 0;
  });
  const instalmentOutflow = activeInstalments.reduce((s, ip) => s + ip.monthly_amount, 0);

  const subOutflow = (activeSubscriptions ?? []).reduce(
    (s, sub) => s + toMonthly(sub.amount, sub.billing_cycle),
    0
  );

  const activeSavings = (savingsPlans ?? []).filter(
    (sp) => sp.target_date && sp.target_amount > (sp.current_amount ?? 0)
  );
  const savingsOutflow = activeSavings.reduce((s, sp) => {
    const monthsLeft = Math.max(1, differenceInMonths(new Date(sp.target_date!), today2));
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
      debts: activeDebtsForBudget.length,
      creditCards: (creditCardsBudget ?? []).length,
      instalments: activeInstalments.length,
      subscriptions: (activeSubscriptions ?? []).length,
      savings: activeSavings.length,
    },
  };
  // ─────────────────────────────────────────────────────────────────────────────

  const paymentsByDebt: Record<string, number> = {};
  const debtIds = new Set((activeDebts ?? []).map((d) => d.id));
  (debtPaymentsAll ?? []).forEach((p) => {
    if (!debtIds.has(p.debt_id)) return;
    paymentsByDebt[p.debt_id] = (paymentsByDebt[p.debt_id] ?? 0) + p.amount;
  });

  const spendByCategory: Record<string, number> = {};
  (monthlyTxs ?? [])
    .filter((t) => ["expense", "credit_charge"].includes(t.type))
    .forEach((t) => {
      const key = t.category_id ?? "uncategorised";
      spendByCategory[key] = (spendByCategory[key] ?? 0) + t.amount + (t.fee_amount ?? 0);
    });

  const monthlyIncome = (monthlyTxs ?? [])
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);

  const monthlyExpenses = Object.values(spendByCategory).reduce((s, v) => s + v, 0);

  const weekIncome = (weekTxs ?? [])
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const weekSpend = (weekTxs ?? [])
    .filter((t) => ["expense", "credit_charge"].includes(t.type))
    .reduce((s, t) => s + t.amount + (t.fee_amount ?? 0), 0);

  const topMerchants: { name: string; amount: number }[] = [];
  const merchantTotals: Record<string, number> = {};
  (monthlyTxs ?? [])
    .filter((t) => ["expense", "credit_charge"].includes(t.type) && t.merchant_id)
    .forEach((t) => {
      const m = t.merchants as { name: string } | { name: string }[] | null;
      const name = Array.isArray(m) ? m[0]?.name ?? "Unknown" : m?.name ?? "Unknown";
      const id = t.merchant_id as string;
      const key = `${id}:${name}`;
      merchantTotals[key] = (merchantTotals[key] ?? 0) + t.amount + (t.fee_amount ?? 0);
    });
  Object.entries(merchantTotals).forEach(([key, amount]) => {
    const name = key.split(":").slice(1).join(":") || "Unknown";
    topMerchants.push({ name, amount });
  });
  topMerchants.sort((a, b) => b.amount - a.amount);
  const topMerchantsTop = topMerchants.slice(0, 8);

  const totalCategoryBudget = (categories ?? []).reduce(
    (s, c) => s + (c.budget_amount && c.budget_amount > 0 ? c.budget_amount : 0),
    0
  );
  const WEEKS_PER_MONTH = 4.345;
  const weeklyBudgetPortion = totalCategoryBudget > 0 ? totalCategoryBudget / WEEKS_PER_MONTH : 0;

  const userStatements = (statements ?? []).filter(
    (s) => (s.credit_card as { user_id: string } | null)?.user_id === user.id
  );

  const debtsWithPayments =
    (activeDebts ?? []).map((d) => {
      const paidRecorded = paymentsByDebt[d.id] ?? 0;
      const paidFallback = Math.max(0, d.original_amount - d.current_balance);
      const paidTowardLoan = paidRecorded > 0 ? paidRecorded : paidFallback;
      const pct =
        d.original_amount > 0
          ? Math.min(100, (paidTowardLoan / d.original_amount) * 100)
          : 0;
      return {
        id: d.id,
        name: d.name,
        original_amount: d.original_amount,
        current_balance: d.current_balance,
        monthly_payment: d.monthly_payment,
        payment_due_day: d.payment_due_day,
        paidTowardLoan,
        progressPct: pct,
      };
    }) ?? [];

  return (
    <DashboardClient
      accounts={accounts ?? []}
      creditCards={creditCards ?? []}
      recentTransactions={recentTxs ?? []}
      activeSubscriptions={activeSubscriptions ?? []}
      displayName={profile?.display_name ?? ""}
      allocation={allocation ?? null}
      upcomingDueDates={userStatements}
      categories={categories ?? []}
      spendByCategory={spendByCategory}
      monthlyIncome={monthlyIncome}
      monthlyExpenses={monthlyExpenses}
      weekIncome={weekIncome}
      weekSpend={weekSpend}
      topMerchants={topMerchantsTop}
      merchants={merchants ?? []}
      categoriesForForms={categoriesForForms ?? []}
      totalCategoryBudget={totalCategoryBudget}
      weeklyBudgetPortion={weeklyBudgetPortion}
      instalmentPlans={instalmentPlans ?? []}
      debtsProgress={debtsWithPayments}
      budgetSummary={budgetSummary}
    />
  );
}
