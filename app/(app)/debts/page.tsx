import { createClient } from "@/lib/supabase/server";
import { DebtsPageClient } from "./debts-client";
import { isProSubscriber } from "@/lib/subscription-access";
import { UpgradePrompt } from "@/components/subscription/upgrade-prompt";

export default async function DebtsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: planProfile } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("id", user!.id)
    .single();

  if (!isProSubscriber(planProfile)) {
    return (
      <UpgradePrompt
        title="Debts is a Pro feature"
        description="Upgrade to Pro to track loans, instalments, payoff strategies, and payments in one place."
      />
    );
  }

  const [
    { data: debts },
    { data: debtPayments },
    { data: creditCards },
    { data: instalmentPlans },
    { data: debtStrategy },
    { data: accounts },
    { data: healthSnapshot },
  ] = await Promise.all([
    supabase
      .from("debts")
      .select("*")
      .eq("user_id", user!.id)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase
      .from("debt_payments")
      .select("*")
      .order("date", { ascending: false }),
    supabase
      .from("credit_cards")
      .select("*")
      .eq("user_id", user!.id)
      .eq("is_active", true),
    supabase
      .from("instalment_plans")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("debt_strategies")
      .select("*")
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("accounts")
      .select("id, name, currency_code")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("financial_health_snapshots")
      .select("avg_monthly_salary, avg_monthly_freelance")
      .eq("user_id", user!.id)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const avgMonthlyIncome =
    (healthSnapshot?.avg_monthly_salary ?? 0) +
    (healthSnapshot?.avg_monthly_freelance ?? 0);

  return (
    <DebtsPageClient
      initialDebts={debts ?? []}
      debtPayments={debtPayments ?? []}
      creditCards={creditCards ?? []}
      instalmentPlans={instalmentPlans ?? []}
      debtStrategy={debtStrategy ?? null}
      accounts={accounts ?? []}
      avgMonthlyIncome={avgMonthlyIncome}
    />
  );
}
