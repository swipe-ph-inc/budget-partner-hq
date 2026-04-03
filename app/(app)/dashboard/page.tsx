import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";
import { format, addDays } from "date-fns";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = format(new Date(), "yyyy-MM-dd");
  const thirtyDaysOut = format(addDays(new Date(), 30), "yyyy-MM-dd");
  const sixMonthsAgo = format(new Date(new Date().setMonth(new Date().getMonth() - 6)), "yyyy-MM-dd");
  const currentMonthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");

  const [
    { data: accounts },
    { data: creditCards },
    { data: recentTxs },
    { data: savingsPlans },
    { data: activeSubscriptions },
    { data: activeDebts },
    { data: healthSnapshot },
    { data: profile },
    { data: allocation },
    { data: statements },
    { data: categories },
    { data: monthlyTxs },
    { data: sixMonthTxs },
  ] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user.id).eq("is_active", true).order("type"),
    supabase.from("credit_cards").select("*").eq("user_id", user.id).eq("is_active", true),
    supabase.from("transactions").select("*, category:categories!transactions_category_id_fkey(name,color), merchant:merchants(name)").eq("user_id", user.id).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(10),
    supabase.from("savings_plans").select("*").eq("user_id", user.id).eq("is_achieved", false),
    supabase.from("subscriptions").select("*").eq("user_id", user.id).eq("status", "active").order("next_billing_date").limit(10),
    supabase.from("debts").select("*").eq("user_id", user.id).eq("status", "active"),
    supabase.from("financial_health_snapshots").select("*").eq("user_id", user.id).order("snapshot_date", { ascending: false }).limit(1).single(),
    supabase.from("profiles").select("base_currency, display_name").eq("id", user.id).single(),
    supabase.from("monthly_allocations").select("*, items:allocation_items(*)").eq("user_id", user.id).eq("month", currentMonthStart).order("created_at", { ascending: false }).limit(1).single(),
    supabase.from("credit_card_statements").select("*, credit_card:credit_cards(name, user_id)").gte("due_date", today).lte("due_date", thirtyDaysOut).eq("is_paid", false).order("due_date"),
    supabase.from("categories").select("id, name, color, budget_amount").eq("user_id", user.id),
    supabase.from("transactions").select("amount, fee_amount, type, category_id").eq("user_id", user.id).gte("date", currentMonthStart).lte("date", today),
    supabase.from("transactions").select("amount, type, date, income_type").eq("user_id", user.id).gte("date", sixMonthsAgo).order("date"),
  ]);

  // Calculate outstanding balance per card
  const { data: allCardTxs } = await supabase
    .from("transactions")
    .select("amount, fee_amount, type, credit_card_id")
    .eq("user_id", user.id)
    .in("type", ["credit_charge", "credit_payment"])
    .not("credit_card_id", "is", null);

  const cardBalances: Record<string, number> = {};
  (allCardTxs ?? []).forEach((tx) => {
    if (!tx.credit_card_id) return;
    if (!cardBalances[tx.credit_card_id]) cardBalances[tx.credit_card_id] = 0;
    if (tx.type === "credit_charge") cardBalances[tx.credit_card_id] += tx.amount + (tx.fee_amount ?? 0);
    if (tx.type === "credit_payment") cardBalances[tx.credit_card_id] -= tx.amount;
  });

  // Calculate spend by category this month
  const spendByCategory: Record<string, number> = {};
  (monthlyTxs ?? []).filter((t) => ["expense", "credit_charge"].includes(t.type)).forEach((t) => {
    const key = t.category_id ?? "uncategorised";
    spendByCategory[key] = (spendByCategory[key] ?? 0) + t.amount + (t.fee_amount ?? 0);
  });

  // Build 6-month cash flow
  const cashFlow: Record<string, { salary: number; freelance: number; expenses: number }> = {};
  (sixMonthTxs ?? []).forEach((tx) => {
    const month = tx.date.slice(0, 7);
    if (!cashFlow[month]) cashFlow[month] = { salary: 0, freelance: 0, expenses: 0 };
    if (tx.type === "income" && tx.income_type === "salary") cashFlow[month].salary += tx.amount;
    if (tx.type === "income" && tx.income_type === "freelance") cashFlow[month].freelance += tx.amount;
    if (["expense", "credit_charge"].includes(tx.type)) cashFlow[month].expenses += tx.amount;
  });

  const userStatements = (statements ?? []).filter(
    (s) => (s.credit_card as { user_id: string } | null)?.user_id === user.id
  );

  const monthlyIncome = (monthlyTxs ?? [])
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <DashboardClient
      accounts={accounts ?? []}
      creditCards={(creditCards ?? []).map((c) => ({ ...c, outstanding_balance: cardBalances[c.id] ?? 0 }))}
      recentTransactions={recentTxs ?? []}
      savingsPlans={savingsPlans ?? []}
      activeSubscriptions={activeSubscriptions ?? []}
      activeDebts={activeDebts ?? []}
      healthSnapshot={healthSnapshot ?? null}
      baseCurrency={profile?.base_currency ?? "PHP"}
      displayName={profile?.display_name ?? ""}
      allocation={allocation ?? null}
      upcomingDueDates={userStatements}
      categories={categories ?? []}
      spendByCategory={spendByCategory}
      cashFlowData={cashFlow}
      monthlyIncome={monthlyIncome}
    />
  );
}
