import { createClient } from "@/lib/supabase/server";
import { ExpensesPageClient } from "./expenses-client";
import type { Database } from "@/types/database";
import { freeTierHistoryStartDate, isProSubscriber } from "@/lib/subscription-access";

type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"] & {
  categories: { id: string; name: string; color: string | null } | null;
  merchants: { id: string; name: string } | null;
};

type TxExpenseRow = Database["public"]["Tables"]["transactions"]["Row"] & {
  categories: { id: string; name: string; color: string | null } | null;
  merchants: { id: string; name: string } | null;
};

/** Map outgoing spend from `transactions` into the same shape as `expenses` rows for one list. */
function mapTransactionToExpenseLike(tx: TxExpenseRow, userId: string): ExpenseRow {
  const total = Number(tx.amount) + Number(tx.fee_amount ?? 0);
  return {
    id: tx.id,
    user_id: userId,
    date: tx.date,
    amount: total,
    currency_code: tx.currency_code,
    category_id: tx.category_id,
    merchant_id: tx.merchant_id,
    account_id: tx.from_account_id,
    credit_card_id: tx.credit_card_id,
    description: tx.description,
    receipt_url: tx.attachment_url,
    tags: tx.tags,
    is_recurring: false,
    recurrence_rule: null,
    instalment_plan_id: tx.instalment_plan_id,
    created_at: tx.created_at,
    categories: tx.categories,
    merchants: tx.merchants,
  };
}

function mergeExpenseSources(
  ledger: ExpenseRow[] | null,
  transactions: TxExpenseRow[] | null,
  userId: string
): (ExpenseRow & { source: "ledger" | "transaction"; txType?: string })[] {
  const fromLedger = (ledger ?? []).map((e) => ({
    ...e,
    source: "ledger" as const,
  }));
  const fromTx = (transactions ?? []).map((tx) => ({
    ...mapTransactionToExpenseLike(tx, userId),
    source: "transaction" as const,
    txType: tx.type,
  }));
  return [...fromLedger, ...fromTx].sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
  });
}

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
    { data: txExpenseRows },
    { data: categories },
    { data: merchants },
    { data: accounts },
    { data: creditCards },
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select("*, categories(id, name, color), merchants(id, name)")
      .eq("user_id", user!.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("transactions")
      .select(
        "*, categories!transactions_category_id_fkey(id, name, color), merchants(id, name)"
      )
      .eq("user_id", user!.id)
      .in("type", ["expense", "credit_charge"])
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
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

  const merged = mergeExpenseSources(
    (expenseRows as ExpenseRow[]) ?? [],
    (txExpenseRows as TxExpenseRow[]) ?? [],
    user!.id
  );

  const visible = !isPro
    ? merged.filter((e) => e.date >= historyStart)
    : merged;

  return (
    <ExpensesPageClient
      initialExpenses={visible as any}
      categories={(categories as any) ?? []}
      merchants={merchants ?? []}
      accounts={accounts ?? []}
      creditCards={creditCards ?? []}
      isPro={isPro}
      freeHistoryMinDate={!isPro ? historyStart : undefined}
    />
  );
}
