import { createClient } from "@/lib/supabase/server";
import { SavingsPageClient } from "./savings-client";
import { isProSubscriber } from "@/lib/subscription-access";
import { UpgradePrompt } from "@/components/subscription/upgrade-prompt";

export default async function SavingsPage() {
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
        title="Savings goals are a Pro feature"
        description="Upgrade to Pro to set targets, track contributions, and monitor progress toward your savings goals."
      />
    );
  }

  const [
    { data: plans },
    { data: accounts },
    { data: contributions },
  ] = await Promise.all([
    supabase
      .from("savings_plans")
      .select("*")
      .eq("user_id", user!.id)
      .eq("is_achieved", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("accounts")
      .select("id, name, currency_code")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("savings_contributions")
      .select("*")
      .order("date", { ascending: false }),
  ]);

  return (
    <SavingsPageClient
      initialPlans={plans ?? []}
      accounts={accounts ?? []}
      initialContributions={contributions ?? []}
    />
  );
}
