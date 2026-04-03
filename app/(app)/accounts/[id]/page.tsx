import { createClient } from "@/lib/supabase/server";
import { AccountDetailClient } from "./account-detail-client";
import { notFound } from "next/navigation";

/** Match transactions list; categories has two FKs (main + fee) — disambiguate for PostgREST. */
const TX_SELECT =
  "*, accounts!from_account_id(name, currency_code), categories!transactions_category_id_fkey(name, color), merchants(name)";

interface Props {
  params: Promise<{ id: string }>;
}

/** PostgREST errors are `Error` subclasses; logging the object often prints `{}`. */
function formatSupabaseErr(err: unknown): string | null {
  if (err == null) return null;
  if (err instanceof Error) {
    const e = err as Error & { code?: string; details?: string; hint?: string };
    const parts = [e.message, e.code, e.details, e.hint].filter(
      (x): x is string => typeof x === "string" && x.length > 0
    );
    return parts.length ? parts.join(" | ") : null;
  }
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    const parts = [o.message, o.code, o.details, o.hint].filter(
      (x): x is string => typeof x === "string" && x.length > 0
    );
    return parts.length ? parts.join(" | ") : null;
  }
  return String(err);
}

function mergeAccountTransactions(
  fromRows: Record<string, unknown>[] | null,
  toRows: Record<string, unknown>[] | null
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of [...(fromRows ?? []), ...(toRows ?? [])]) {
    const id = row.id as string;
    if (id) byId.set(id, row as Record<string, unknown>);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const da = String(a.date ?? "");
    const db = String(b.date ?? "");
    const c = db.localeCompare(da);
    if (c !== 0) return c;
    return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
  });
}

export default async function AccountDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: account },
    { data: txFrom, error: errFrom },
    { data: txTo, error: errTo },
    { data: accounts },
    { data: categories },
    { data: merchants },
    { data: creditCards },
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("id", id)
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("transactions")
      .select(TX_SELECT)
      .eq("user_id", user!.id)
      .eq("from_account_id", id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("transactions")
      .select(TX_SELECT)
      .eq("user_id", user!.id)
      .eq("to_account_id", id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
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

  if (!account) notFound();

  const txErrMsg = formatSupabaseErr(errFrom) ?? formatSupabaseErr(errTo);
  if (txErrMsg) {
    console.error("[account detail] transactions query", txErrMsg);
  }

  const transactions = mergeAccountTransactions(
    (txFrom ?? []) as Record<string, unknown>[],
    (txTo ?? []) as Record<string, unknown>[]
  ).slice(0, 100);

  return (
    <AccountDetailClient
      account={account}
      initialTransactions={transactions as any}
      accounts={accounts ?? []}
      categories={(categories as any) ?? []}
      merchants={merchants ?? []}
      creditCards={creditCards ?? []}
    />
  );
}
