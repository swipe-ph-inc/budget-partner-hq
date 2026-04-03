import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Runs daily at 00:05 to auto-charge subscriptions
Deno.serve(async () => {
  const today = new Date().toISOString().slice(0, 10);

  const { data: subscriptions, error } = await supabase
    .from("subscriptions")
    .select("*, credit_card:credit_cards(id, user_id), account:accounts(id, user_id)")
    .eq("next_billing_date", today)
    .eq("status", "active")
    .eq("auto_log_transaction", true);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const results: string[] = [];

  for (const sub of subscriptions ?? []) {
    try {
      const userId = (sub.credit_card as { user_id: string } | null)?.user_id
        ?? (sub.account as { user_id: string } | null)?.user_id;

      if (!userId) continue;

      // Create transaction
      await supabase.from("transactions").insert({
        user_id: userId,
        type: sub.payment_method_type === "credit_card" ? "credit_charge" : "expense",
        date: today,
        amount: sub.amount,
        currency_code: sub.currency_code,
        fee_amount: sub.fee_amount ?? 0,
        credit_card_id: sub.credit_card_id ?? null,
        from_account_id: sub.account_id ?? null,
        category_id: sub.category_id ?? null,
        description: `${sub.name} subscription`,
        subscription_id: sub.id,
      });

      // Advance next_billing_date
      const next = advanceDate(sub.next_billing_date, sub.billing_cycle);
      await supabase
        .from("subscriptions")
        .update({ last_billed_date: today, next_billing_date: next })
        .eq("id", sub.id);

      results.push(`✓ ${sub.name}: charged ${sub.amount} ${sub.currency_code}, next: ${next}`);
    } catch (err) {
      results.push(`✗ ${sub.id} ${sub.name}: ${err}`);
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});

function advanceDate(dateStr: string, cycle: string): string {
  const d = new Date(dateStr);
  switch (cycle) {
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "yearly": d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}
