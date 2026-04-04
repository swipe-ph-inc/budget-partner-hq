import { createClient } from "@/lib/supabase/server";
import { ExpensesPageClient } from "./expenses-client";
import type { Database } from "@/types/database";
import { freeTierHistoryStartDate, isProSubscriber } from "@/lib/subscription-access";

type ExpenseRow = Database["public"]["Tables"]["transactions"]["Row"] & {
  categories: { id: string; name: string; color: string | null } | null;
  merchants: { id: string; name: string } | null;
};

export default async function ExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("id", user!.id)
    .single();

  const isPro = isProSubscriber(profile);
  const historyStart = freeTierHistoryStartDate();

  const [
    { data: expenseRows },
    { data: categories },
    { data: merchants },
    { data: accounts },
    { data: creditCards },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, categories!transactions_category_id_fkey(id, name, color), merchants(id, name)")
      .eq("user_id", user!.id)
      .in("type", ["expense", "credit_charge"])
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("categories")
      .select("id, name, color")
      .eq("user_id", user!.id)
      .order("name"),
    supabase
      .from("merchants")
      .select("id, name")
      .eq("user_id", user!.id)
      .order("name"),
    supabase
      .from("accounts")
      .select("id, name, currency_code")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("credit_cards")
      .select("id, name, last_four, currency_code")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .order("name"),
  ]);

  const allExpenses = (expenseRows as ExpenseRow[]) ?? [];
  const visible = !isPro
    ? allExpenses.filter((e) => e.date >= historyStart)
    : allExpenses;

  return (
    <ExpensesPageClient
      initialExpenses={visible}
      categories={(categories as any) ?? []}
      merchants={merchants ?? []}
      accounts={accounts ?? []}
      creditCards={creditCards ?? []}
      isPro={isPro}
      freeHistoryMinDate={!isPro ? historyStart : undefined}
    />
  );
}
