import { createClient } from "@/lib/supabase/server";
import { SubscriptionsPageClient } from "./subscriptions-client";

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: subscriptions },
    { data: creditCards },
    { data: accounts },
    { data: categories },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user!.id)
      .order("status")
      .order("name"),
    supabase
      .from("credit_cards")
      .select("id, name, last_four, currency_code")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("accounts")
      .select("id, name, currency_code")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("categories")
      .select("id, name")
      .eq("user_id", user!.id)
      .order("name"),
  ]);

  return (
    <SubscriptionsPageClient
      initialSubscriptions={subscriptions ?? []}
      creditCards={creditCards ?? []}
      accounts={accounts ?? []}
      categories={categories ?? []}
    />
  );
}
