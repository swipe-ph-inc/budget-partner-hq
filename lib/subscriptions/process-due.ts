import type { SupabaseClient } from "@supabase/supabase-js";
import { advanceBillingDate } from "@/lib/utils";

export interface ProcessResult {
  subscription_id: string;
  name: string;
  transactions_created: number;
  skipped?: string;
}

/**
 * Find and auto-log all due subscriptions for a given user (or all users if
 * userId is omitted — used by the server-side cron job).
 *
 * For each active subscription with `auto_log_transaction = true` and
 * `next_billing_date <= today`, one transaction per missed billing cycle is
 * inserted (up to MAX_CYCLES), then `last_billed_date` / `next_billing_date`
 * are advanced on the subscription row.
 */
export async function processDueSubscriptions(
  supabase: SupabaseClient,
  userId?: string
): Promise<ProcessResult[]> {
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("subscriptions")
    .select("*")
    .eq("status", "active")
    .eq("auto_log_transaction", true)
    .lte("next_billing_date", today);

  if (userId) query = query.eq("user_id", userId);

  const { data: subscriptions, error } = await query;
  if (error || !subscriptions?.length) return [];

  const results: ProcessResult[] = [];
  const MAX_CYCLES = 24; // guard against very old next_billing_date values

  for (const sub of subscriptions) {
    // Must have a valid payment target
    const hasTarget =
      (sub.payment_method_type === "credit_card" && sub.credit_card_id) ||
      (sub.payment_method_type === "account" && sub.account_id);

    if (!hasTarget) {
      results.push({
        subscription_id: sub.id,
        name: sub.name,
        transactions_created: 0,
        skipped: "No payment method configured",
      });
      continue;
    }

    // Build one transaction per overdue cycle
    const txRows: Record<string, unknown>[] = [];
    let nextDate = new Date(sub.next_billing_date + "T00:00:00");
    const todayDate = new Date(today + "T00:00:00");

    while (nextDate <= todayDate && txRows.length < MAX_CYCLES) {
      const txDate = nextDate.toISOString().slice(0, 10);

      const tx: Record<string, unknown> = {
        user_id: sub.user_id,
        amount: sub.amount,
        fee_amount: sub.fee_amount ?? 0,
        ...(sub.fee_amount > 0 ? { fee_currency_code: sub.currency_code } : {}),
        currency_code: sub.currency_code,
        date: txDate,
        description: sub.name,
        subscription_id: sub.id,
        category_id: sub.category_id ?? null,
        is_collected: true,
      };

      if (sub.payment_method_type === "credit_card") {
        tx.type = "credit_charge";
        tx.credit_card_id = sub.credit_card_id;
      } else {
        tx.type = "expense";
        tx.from_account_id = sub.account_id;
      }

      txRows.push(tx);
      nextDate = advanceBillingDate(nextDate, sub.billing_cycle);
    }

    if (txRows.length === 0) continue;

    const { error: txError } = await supabase.from("transactions").insert(txRows);

    if (txError) {
      results.push({
        subscription_id: sub.id,
        name: sub.name,
        transactions_created: 0,
        skipped: txError.message,
      });
      continue;
    }

    // Advance the subscription dates
    const lastBilled = txRows[txRows.length - 1].date as string;
    await supabase
      .from("subscriptions")
      .update({
        last_billed_date: lastBilled,
        next_billing_date: nextDate.toISOString().slice(0, 10),
      })
      .eq("id", sub.id);

    results.push({
      subscription_id: sub.id,
      name: sub.name,
      transactions_created: txRows.length,
    });
  }

  return results;
}
