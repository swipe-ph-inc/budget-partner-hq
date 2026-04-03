import { createClient } from "@/lib/supabase/server";
import { CreditCardDetailClient } from "./credit-card-detail-client";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CreditCardDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: card },
    { data: statements },
    { data: transactions },
    { data: instalmentPlans },
  ] = await Promise.all([
    supabase
      .from("credit_cards")
      .select("*")
      .eq("id", id)
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("credit_card_statements")
      .select("*")
      .eq("credit_card_id", id)
      .order("period_start", { ascending: false }),
    supabase
      .from("transactions")
      .select(
        "*, categories!transactions_category_id_fkey(name, color), merchants(name)"
      )
      .eq("credit_card_id", id)
      .eq("user_id", user!.id)
      .order("date", { ascending: false })
      .limit(100),
    supabase
      .from("instalment_plans")
      .select("*")
      .eq("credit_card_id", id)
      .order("start_month", { ascending: false }),
  ]);

  if (!card) notFound();

  // Calculate outstanding balance
  const txList = (transactions ?? []) as any[];
  const outstanding = txList.reduce((sum: number, tx: any) => {
    if (tx.type === "credit_charge") return sum + tx.amount;
    if (tx.type === "credit_payment") return sum - tx.amount;
    return sum;
  }, 0);

  return (
    <CreditCardDetailClient
      card={{ ...card, outstanding_balance: Math.max(0, outstanding) }}
      statements={statements ?? []}
      transactions={txList}
      instalmentPlans={instalmentPlans ?? []}
    />
  );
}
