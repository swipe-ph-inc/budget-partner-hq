import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";
import { formatCurrency } from "@/lib/utils";

export interface NotificationRow {
  user_id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  deduplication_key?: string;
}

/**
 * Checks all financial conditions for the given user and inserts
 * notifications that haven't been created yet (dedup via unique index).
 *
 * Conditions checked:
 *  1. Subscriptions due today or overdue
 *  2. Credit card payment due within 7 days or overdue
 *  3. Category budget overspent this month
 *  4. Savings goal milestones (25 / 50 / 75 / 100 %)
 *  5. Low freelance buffer (< 1.5 months)
 *  6. High aggregate credit utilisation (> 70 %)
 *  7. Instalment plans — monthly due, last payment, and completed
 */
export async function generateNotificationsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const monthKey = todayStr.slice(0, 7);
  const monthStart = `${monthKey}-01`;

  // ── Fetch all data in parallel ─────────────────────────────────────────────
  const sevenDaysOut = new Date(today);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  const sevenDaysOutStr = sevenDaysOut.toISOString().slice(0, 10);
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);

  // Monday of the current week
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekKey = weekStartStr; // dedup key for weekly notifications

  const [
    { data: profileRow },
    { data: subs },
    { data: subsUpcoming },
    { data: cards },
    { data: categories },
    { data: monthlyTxs },
    { data: allCardTxs },
    { data: savingsPlans },
    { data: snapshot },
    { data: weeklyTxs },
  ] = await Promise.all([
    supabase.from("profiles").select("base_currency").eq("id", userId).single(),
    supabase
      .from("subscriptions")
      .select("id, name, amount, currency_code, next_billing_date")
      .eq("user_id", userId)
      .eq("status", "active")
      .lte("next_billing_date", todayStr),

    supabase
      .from("subscriptions")
      .select("id, name, amount, currency_code, next_billing_date")
      .eq("user_id", userId)
      .eq("status", "active")
      .gte("next_billing_date", tomorrowStr)
      .lte("next_billing_date", sevenDaysOutStr),

    supabase
      .from("credit_cards")
      .select("id, name, credit_limit, payment_due_day, currency_code")
      .eq("user_id", userId)
      .eq("is_active", true),

    supabase
      .from("categories")
      .select("id, name, budget_amount")
      .eq("user_id", userId)
      .not("budget_amount", "is", null)
      .gt("budget_amount", 0),

    supabase
      .from("transactions")
      .select("amount, fee_amount, type, category_id")
      .eq("user_id", userId)
      .gte("date", monthStart)
      .lte("date", todayStr),

    supabase
      .from("transactions")
      .select("amount, type, credit_card_id")
      .eq("user_id", userId)
      .in("type", ["credit_charge", "credit_payment"])
      .not("credit_card_id", "is", null),

    supabase
      .from("savings_plans")
      .select("id, name, current_amount, target_amount, currency_code")
      .eq("user_id", userId)
      .eq("is_achieved", false),

    supabase
      .from("financial_health_snapshots")
      .select("freelance_buffer_months, aggregate_credit_utilisation")
      .eq("user_id", userId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single(),

    supabase
      .from("transactions")
      .select("amount, fee_amount, type, category_id")
      .eq("user_id", userId)
      .gte("date", weekStartStr)
      .lte("date", todayStr),
  ]);

  const displayCurrency = profileRow?.base_currency ?? "PHP";

  // Instalment plans need card IDs — fetch after the parallel block
  const cardIds = (cards ?? []).map((c) => c.id);
  const { data: instalmentPlans } = cardIds.length > 0
    ? await supabase
        .from("instalment_plans")
        .select("id, description, monthly_amount, total_amount, months, start_month, currency_code, credit_card_id")
        .in("credit_card_id", cardIds)
    : { data: [] };

  const notifications: NotificationRow[] = [];

  // ── 1. Subscriptions due / overdue ────────────────────────────────────────
  for (const sub of subs ?? []) {
    const dueDateMs = new Date(sub.next_billing_date + "T00:00:00").getTime();
    const daysOver = Math.round((today.getTime() - dueDateMs) / 86400000);
    notifications.push({
      user_id: userId,
      type: "subscription_due",
      title: daysOver > 0 ? `${sub.name} payment overdue` : `${sub.name} is due today`,
      body: daysOver > 0
        ? `${formatCurrency(sub.amount, displayCurrency)} — ${daysOver}d overdue`
        : formatCurrency(sub.amount, displayCurrency),
      link: "/subscriptions",
      deduplication_key: `subscription_due:${sub.id}:${todayStr}`,
    });
  }

  // ── 1b. Subscriptions due in 1–7 days ────────────────────────────────────
  for (const sub of subsUpcoming ?? []) {
    const dueDate = new Date(sub.next_billing_date + "T00:00:00");
    const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    notifications.push({
      user_id: userId,
      type: "subscription_upcoming",
      title: `${sub.name} due in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`,
      body: formatCurrency(sub.amount, displayCurrency),
      link: "/subscriptions",
      // dedup per billing date — fires once no matter how many days before it's generated
      deduplication_key: `subscription_upcoming:${sub.id}:${sub.next_billing_date}`,
    });
  }

  // ── 2. Credit card payments due soon / overdue ────────────────────────────
  // Build outstanding balance map from all transactions
  const cardBalances: Record<string, number> = {};
  for (const tx of allCardTxs ?? []) {
    if (!tx.credit_card_id) continue;
    cardBalances[tx.credit_card_id] = (cardBalances[tx.credit_card_id] ?? 0) +
      (tx.type === "credit_charge" ? tx.amount : -tx.amount);
  }

  for (const card of cards ?? []) {
    if (!card.payment_due_day) continue;
    const outstanding = Math.max(0, cardBalances[card.id] ?? 0);
    if (outstanding <= 0) continue;

    const dueDate = new Date(today.getFullYear(), today.getMonth(), card.payment_due_day);
    if (dueDate < today) dueDate.setMonth(dueDate.getMonth() + 1);
    const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / 86400000);

    if (daysUntil <= 7) {
      const overdue = daysUntil < 0;
      notifications.push({
        user_id: userId,
        type: overdue ? "credit_card_overdue" : "credit_card_due",
        title: overdue
          ? `${card.name} payment is overdue`
          : `${card.name} payment due in ${daysUntil}d`,
        body: `Outstanding: ${formatCurrency(outstanding, displayCurrency)}`,
        link: `/credit-cards/${card.id}`,
        deduplication_key: `credit_card_due:${card.id}:${monthKey}`,
      });
    }
  }

  // ── 3. Budget overspent this month ────────────────────────────────────────
  const spendByCategory: Record<string, number> = {};
  for (const tx of monthlyTxs ?? []) {
    if (!["expense", "credit_charge"].includes(tx.type) || !tx.category_id) continue;
    spendByCategory[tx.category_id] =
      (spendByCategory[tx.category_id] ?? 0) + tx.amount + (tx.fee_amount ?? 0);
  }

  for (const cat of categories ?? []) {
    if (!cat.budget_amount) continue;
    const spent = spendByCategory[cat.id] ?? 0;
    if (spent > cat.budget_amount) {
      const overage = spent - cat.budget_amount;
      notifications.push({
        user_id: userId,
        type: "budget_overspent",
        title: `${cat.name} budget exceeded`,
        body: `Over by ${formatCurrency(overage, displayCurrency)} this month`,
        link: "/categories",
        deduplication_key: `budget_overspent:${cat.id}:${monthKey}`,
      });
    }
  }

  // ── 3b. Monthly budget running low (≥ 80 % spent, not yet exceeded) ─────
  for (const cat of categories ?? []) {
    if (!cat.budget_amount) continue;
    const spent = spendByCategory[cat.id] ?? 0;
    const pct = spent / cat.budget_amount;
    if (pct >= 0.8 && pct < 1) {
      notifications.push({
        user_id: userId,
        type: "budget_low",
        title: `${cat.name} budget is running low`,
        body: `${Math.round(pct * 100)}% used — ${formatCurrency(cat.budget_amount - spent, displayCurrency)} remaining this month`,
        link: "/categories",
        deduplication_key: `budget_low:${cat.id}:${monthKey}`,
      });
    }
  }

  // ── 3c. Weekly budget running low (≥ 80 % of weekly slice spent) ─────────
  const WEEKS_PER_MONTH = 4.345;
  const weeklySpendByCategory: Record<string, number> = {};
  for (const tx of weeklyTxs ?? []) {
    if (!["expense", "credit_charge"].includes(tx.type) || !tx.category_id) continue;
    weeklySpendByCategory[tx.category_id] =
      (weeklySpendByCategory[tx.category_id] ?? 0) + tx.amount + (tx.fee_amount ?? 0);
  }

  for (const cat of categories ?? []) {
    if (!cat.budget_amount) continue;
    const weeklySlice = cat.budget_amount / WEEKS_PER_MONTH;
    const weeklySpent = weeklySpendByCategory[cat.id] ?? 0;
    const pct = weeklySpent / weeklySlice;
    if (pct >= 0.8) {
      notifications.push({
        user_id: userId,
        type: "budget_low_weekly",
        title: `${cat.name} weekly budget is running low`,
        body: `${Math.round(pct * 100)}% of this week's slice used — ${formatCurrency(Math.max(0, weeklySlice - weeklySpent), displayCurrency)} left`,
        link: "/categories",
        deduplication_key: `budget_low_weekly:${cat.id}:${weekKey}`,
      });
    }
  }

  // ── 4. Savings goal milestones ────────────────────────────────────────────
  const MILESTONES = [25, 50, 75, 100];
  for (const plan of savingsPlans ?? []) {
    if (plan.target_amount <= 0) continue;
    const pct = (plan.current_amount / plan.target_amount) * 100;
    for (const m of MILESTONES) {
      if (pct >= m) {
        notifications.push({
          user_id: userId,
          type: "savings_milestone",
          title: m === 100 ? `${plan.name} goal reached!` : `${plan.name} is ${m}% funded`,
          body: `${formatCurrency(plan.current_amount, displayCurrency)} of ${formatCurrency(plan.target_amount, displayCurrency)}`,
          link: "/savings",
          deduplication_key: `savings_milestone:${plan.id}:${m}`,
        });
      }
    }
  }

  // ── 5. Low freelance buffer ───────────────────────────────────────────────
  const buffer = snapshot?.freelance_buffer_months ?? 0;
  if (buffer > 0 && buffer < 1.5) {
    notifications.push({
      user_id: userId,
      type: "low_buffer",
      title: "Freelance buffer is low",
      body: `${buffer.toFixed(1)} months remaining — target is 3 months`,
      link: "/dashboard",
      deduplication_key: `low_buffer:${monthKey}`,
    });
  }

  // ── 6. High aggregate credit utilisation ─────────────────────────────────
  const util = snapshot?.aggregate_credit_utilisation ?? 0;
  if (util > 0.7) {
    notifications.push({
      user_id: userId,
      type: "high_credit_utilisation",
      title: "High credit utilisation",
      body: `${(util * 100).toFixed(0)}% across all cards — keep below 30%`,
      link: "/credit-cards",
      deduplication_key: `high_credit_utilisation:${monthKey}`,
    });
  }

  // ── 7. Instalment plan notifications ─────────────────────────────────────
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  for (const plan of instalmentPlans ?? []) {
    const startDate = new Date(plan.start_month + "T00:00:00");
    // Normalise to first of the month to avoid time-zone drift
    startDate.setDate(1);

    const lastMonthStart = new Date(startDate);
    lastMonthStart.setMonth(lastMonthStart.getMonth() + plan.months - 1);

    const card = (cards ?? []).find((c) => c.id === plan.credit_card_id);
    const cardLink = card ? `/credit-cards/${card.id}` : "/credit-cards";

    // Plan hasn't started yet — skip
    if (currentMonthStart < startDate) continue;

    // Plan is complete (past the last payment month)
    if (currentMonthStart > lastMonthStart) {
      notifications.push({
        user_id: userId,
        type: "instalment_complete",
        title: `${plan.description} is fully paid`,
        body: `All ${plan.months} monthly payments of ${formatCurrency(plan.monthly_amount, displayCurrency)} are done`,
        link: cardLink,
        deduplication_key: `instalment_complete:${plan.id}`,
      });
      continue;
    }

    // Active this month — check if it's the last payment
    const isLastMonth =
      currentMonthStart.getFullYear() === lastMonthStart.getFullYear() &&
      currentMonthStart.getMonth() === lastMonthStart.getMonth();

    const monthsElapsed =
      (currentMonthStart.getFullYear() - startDate.getFullYear()) * 12 +
      (currentMonthStart.getMonth() - startDate.getMonth()) + 1;
    const monthsRemaining = plan.months - monthsElapsed + 1;

    notifications.push({
      user_id: userId,
      type: isLastMonth ? "instalment_last_payment" : "instalment_due",
      title: isLastMonth
        ? `Final payment for ${plan.description}`
        : `${plan.description} instalment due this month`,
      body: isLastMonth
        ? `Last payment of ${formatCurrency(plan.monthly_amount, displayCurrency)} — you're almost done!`
        : `${formatCurrency(plan.monthly_amount, displayCurrency)}/mo · ${monthsRemaining} payment${monthsRemaining !== 1 ? "s" : ""} remaining`,
      link: cardLink,
      deduplication_key: `instalment_due:${plan.id}:${monthKey}`,
    });
  }

  if (notifications.length === 0) return 0;

  // Insert all, silently skip duplicates via the unique index
  const { error } = await supabase
    .from("notifications")
    .upsert(notifications, {
      onConflict: "user_id,deduplication_key",
      ignoreDuplicates: true,
    });

  if (error) {
    logError("notifications/generate", "upsert error", { message: error.message });
  }

  return notifications.length;
}
