import { createClient } from "@/lib/supabase/server";
import { TransactionsPageClient } from "./transactions-client";
import { freeTierHistoryStartDate, isProSubscriber } from "@/lib/subscription-access";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at, base_currency")
    .eq("id", user!.id)
    .single();

  const isPro = isProSubscriber(profile);
  const historyStart = freeTierHistoryStartDate();

  let txQuery = supabase
    .from("transactions")
    .select(
      "*, accounts!from_account_id(name, currency_code), categories!transactions_category_id_fkey(name, color), merchants(name)"
    )
    .eq("user_id", user!.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(isPro ? 500 : 300);

  if (!isPro) {
    txQuery = txQuery.gte("date", historyStart);
  }

  const [
    { data: transactions },
    { data: accounts },
    { data: categories },
    { data: merchants },
    { data: creditCards },
  ] = await Promise.all([
    txQuery,
    supabase
      .from("accounts")
      .select("id, name, currency_code, type")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("categories")
      .select("id, name, color, type")
      .eq("user_id", user!.id)
      .order("name"),
    supabase
      .from("merchants")
      .select("id, name")
      .eq("user_id", user!.id)
      .order("name"),
    supabase
      .from("credit_cards")
      .select("id, name, last_four, currency_code")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <TransactionsPageClient
      initialTransactions={(transactions as any) ?? []}
      accounts={accounts ?? []}
      categories={(categories as any) ?? []}
      merchants={merchants ?? []}
      creditCards={creditCards ?? []}
      isPro={isPro}
      freeHistoryMinDate={!isPro ? historyStart : undefined}
      baseCurrency={profile?.base_currency ?? "PHP"}
    />
  );
}
