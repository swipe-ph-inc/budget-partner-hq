import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Triggered by database trigger after salary income transaction
Deno.serve(async (req) => {
  const { user_id, transaction_id } = await req.json() as { user_id: string; transaction_id: string };

  const today = new Date();
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

  // Idempotency: don't re-run if salary allocation already exists for this month
  const { data: existing } = await supabase
    .from("monthly_allocations")
    .select("id")
    .eq("user_id", user_id)
    .eq("month", currentMonthStart)
    .eq("trigger_type", "salary")
    .single();

  if (existing) {
    return new Response(JSON.stringify({ skipped: true, reason: "Salary allocation already exists for this month" }));
  }

  // Get salary transaction amount
  const { data: tx } = await supabase
    .from("transactions")
    .select("amount")
    .eq("id", transaction_id)
    .single();

  const salaryAmount = tx?.amount ?? 0;

  // Survival cost estimate (last 3 months avg)
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1).toISOString().slice(0, 10);
  const { data: survivalCats } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", user_id)
    .eq("is_survival", true);

  const survivalCatIds = (survivalCats ?? []).map((c: { id: string }) => c.id);
  let survivalEstimate = 15000;
  if (survivalCatIds.length > 0) {
    const { data: survivalExp } = await supabase
      .from("expenses")
      .select("amount")
      .eq("user_id", user_id)
      .in("category_id", survivalCatIds)
      .gte("date", threeMonthsAgo);
    survivalEstimate = (survivalExp ?? []).reduce((s: number, e: { amount: number }) => s + e.amount, 0) / 3;
  }

  // Subscriptions due this month
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("name, amount, fee_amount, currency_code")
    .eq("user_id", user_id)
    .eq("status", "active")
    .gte("next_billing_date", currentMonthStart)
    .lte("next_billing_date", currentMonthEnd);

  const subTotal = (subs ?? []).reduce((s: number, sub: { amount: number; fee_amount: number }) => s + sub.amount + (sub.fee_amount ?? 0), 0);

  // Credit card minimums
  const { data: cards } = await supabase
    .from("credit_cards")
    .select("id, name, min_payment_type, min_payment_value, credit_limit")
    .eq("user_id", user_id)
    .eq("is_active", true);

  const cardMins: Array<{ name: string; amount: number; cardId: string }> = [];
  for (const card of cards ?? []) {
    let minPay = 0;
    if (card.min_payment_type === "flat") minPay = card.min_payment_value ?? 0;
    else if (card.min_payment_type === "percentage") minPay = card.credit_limit * (card.min_payment_value ?? 0.05);
    if (minPay > 0) cardMins.push({ name: card.name, amount: minPay, cardId: card.id });
  }

  // Loan payments
  const { data: debts } = await supabase
    .from("debts")
    .select("name, monthly_payment")
    .eq("user_id", user_id)
    .eq("status", "active");

  const debtPayments = (debts ?? []).filter((d: { monthly_payment: number | null }) => d.monthly_payment && d.monthly_payment > 0) as Array<{ name: string; monthly_payment: number }>;

  // Buffer gap
  const { data: snapshot } = await supabase
    .from("financial_health_snapshots")
    .select("freelance_buffer_months")
    .eq("user_id", user_id)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();

  const bufferMonths = snapshot?.freelance_buffer_months ?? 0;
  const bufferTarget = 3;
  const bufferGap = Math.max(0, (bufferTarget - bufferMonths) * survivalEstimate);

  // Debt strategy extra payment
  const { data: strategy } = await supabase
    .from("debt_strategies")
    .select("extra_monthly_payment, chosen_method")
    .eq("user_id", user_id)
    .single();

  const extraDebtPayment = strategy?.extra_monthly_payment ?? 0;

  // Build allocation items in priority order
  const items: Array<{
    category: "obligation" | "goal" | "spending";
    label: string;
    amount: number;
    priority: number;
    linked_debt_id?: string;
    linked_credit_card_id?: string;
    linked_subscription_id?: string;
  }> = [];

  let priority = 1;

  // P1: Survival
  items.push({ category: "obligation", label: "Survival estimate (rent, utilities, food)", amount: survivalEstimate, priority: priority++ });

  // P2: Credit card minimums
  for (const cm of cardMins) {
    items.push({ category: "obligation", label: `${cm.name} minimum payment`, amount: cm.amount, priority: priority++, linked_credit_card_id: cm.cardId });
  }

  // P2: Loan payments
  for (const d of debtPayments) {
    items.push({ category: "obligation", label: `${d.name} payment`, amount: d.monthly_payment, priority: priority++ });
  }

  // P2: Subscriptions
  if (subTotal > 0) {
    items.push({ category: "obligation", label: "Active subscriptions this month", amount: subTotal, priority: priority++ });
  }

  // P4 Goals: buffer top-up
  if (bufferGap > 0) {
    const topUp = Math.min(bufferGap, salaryAmount * 0.1);
    items.push({ category: "goal", label: `Freelance buffer top-up (→ ${bufferTarget} months)`, amount: topUp, priority: priority++ });
  }

  // P4 Goals: extra debt payment
  if (extraDebtPayment > 0) {
    const methodLabel = strategy?.chosen_method === "avalanche" ? "Avalanche target" : "Snowball target";
    items.push({ category: "goal", label: `Extra debt payment — ${methodLabel}`, amount: extraDebtPayment, priority: priority++ });
  }

  const totalObligations = items.filter((i) => i.category === "obligation").reduce((s, i) => s + i.amount, 0);
  const totalGoals = items.filter((i) => i.category === "goal").reduce((s, i) => s + i.amount, 0);
  const safeToSpend = Math.max(0, salaryAmount - totalObligations - totalGoals);

  // Insert monthly_allocation
  const { data: alloc, error: allocError } = await supabase.from("monthly_allocations").insert({
    user_id,
    month: currentMonthStart,
    trigger_type: "salary",
    trigger_transaction_id: transaction_id,
    total_income_received: salaryAmount,
    total_obligations: totalObligations,
    total_goals: totalGoals,
    safe_to_spend: safeToSpend,
    status: "draft",
  }).select().single();

  if (allocError) {
    return new Response(JSON.stringify({ error: allocError.message }), { status: 500 });
  }

  // Insert allocation items
  for (const item of items) {
    await supabase.from("allocation_items").insert({ allocation_id: alloc.id, ...item });
  }

  return new Response(JSON.stringify({
    success: true,
    allocation_id: alloc.id,
    salary: salaryAmount,
    total_obligations: totalObligations,
    total_goals: totalGoals,
    safe_to_spend: safeToSpend,
    items: items.length,
  }), { headers: { "Content-Type": "application/json" } });
});
