import { createClient } from "@/lib/supabase/server";
import { AccountsPageClient } from "./accounts-client";
import { FREE_TIER_ACCOUNT_LIMIT, isProSubscriber } from "@/lib/subscription-access";

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: accounts }, { data: profile }] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user!.id).eq("is_active", true).order("type").order("name"),
    supabase.from("profiles").select("plan, plan_expires_at").eq("id", user!.id).single(),
  ]);

  const isPro = isProSubscriber(profile);
  const activeCount = (accounts ?? []).length;
  const canAddAccount = isPro || activeCount < FREE_TIER_ACCOUNT_LIMIT;

  return (
    <AccountsPageClient
      initialAccounts={accounts ?? []}
      isPro={isPro}
      canAddAccount={canAddAccount}
      accountLimit={FREE_TIER_ACCOUNT_LIMIT}
    />
  );
}
