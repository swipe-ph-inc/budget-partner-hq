import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Runs daily via cron to compute and store a financial health snapshot per user
Deno.serve(async () => {
  const { data: users, error } = await supabase.from("profiles").select("id, base_currency");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  const threeMonthsAgo = new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().slice(0, 10);
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const results: string[] = [];

  for (const user of users ?? []) {
    try {
      // Get all accounts
      const { data: accounts } = await supabase
        .from("accounts")
        .select("balance")
        .eq("user_id", user.id)
        .eq("is_active", true);

      const totalAssets = (accounts ?? []).reduce((s, a) => s + a.balance, 0);

      // Get all debts + credit card balances
      const { data: debts } = await supabase
        .from("debts")
        .select("current_balance")
        .eq("user_id", user.id)
        .eq("status", "active");

      const { data: cardTxs } = await supabase
        .from("transactions")
        .select("amount, fee_amount, type, credit_card_id")
        .eq("user_id", user.id)
        .in("type", ["credit_charge", "credit_payment"])
        .not("credit_card_id", "is", null);

      const cardBalances: Record<string, number> = {};
      (cardTxs ?? []).forEach((tx) => {
        if (!tx.credit_card_id) return;
        if (!cardBalances[tx.credit_card_id]) cardBalances[tx.credit_card_id] = 0;
        if (tx.type === "credit_charge") cardBalances[tx.credit_card_id] += tx.amount + (tx.fee_amount ?? 0);
        if (tx.type === "credit_payment") cardBalances[tx.credit_card_id] -= tx.amount;
      });

      const totalCardDebt = Object.values(cardBalances).reduce((s, b) => s + Math.max(0, b), 0);
      const totalDebt = (debts ?? []).reduce((s, d) => s + d.current_balance, 0) + totalCardDebt;
      const netWorth = totalAssets - totalDebt;

      // Income averages (last 3 months, collected only)
      const { data: incomeData } = await supabase
        .from("transactions")
        .select("amount, income_type, date")
        .eq("user_id", user.id)
        .eq("type", "income")
        .eq("is_collected", true)
        .gte("date", threeMonthsAgo);

      const salaryIncome = (incomeData ?? []).filter((t) => t.income_type === "salary");
      const freelanceIncome = (incomeData ?? []).filter((t) => t.income_type === "freelance");

      const avgSalary = salaryIncome.reduce((s, t) => s + t.amount, 0) / 3;
      const avgFreelance = freelanceIncome.reduce((s, t) => s + t.amount, 0) / 3;

      // Freelance consistency score: how many of last 3 months had freelance income
      const monthsWithFreelance = new Set(freelanceIncome.map((t) => t.date.slice(0, 7))).size;
      const consistencyScore = monthsWithFreelance / 3;

      // Monthly survival cost: last 3 months avg of survival-category expenses
      const { data: survivalCats } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_survival", true);

      const survivalCatIds = (survivalCats ?? []).map((c) => c.id);

      let survivalCost = 15000; // default if no categories set
      if (survivalCatIds.length > 0) {
        const { data: survivalExpenses } = await supabase
          .from("expenses")
          .select("amount")
          .eq("user_id", user.id)
          .in("category_id", survivalCatIds)
          .gte("date", threeMonthsAgo);
        survivalCost = (survivalExpenses ?? []).reduce((s, e) => s + e.amount, 0) / 3;
      }

      // Freelance buffer: liquid savings / survival cost
      const liquidSavings = (accounts ?? []).reduce((s, a) => s + Math.max(0, a.balance), 0);
      const bufferMonths = survivalCost > 0 ? liquidSavings / survivalCost : 0;

      // Debt to income ratio
      const { data: debtRecords } = await supabase
        .from("debts")
        .select("monthly_payment")
        .eq("user_id", user.id)
        .eq("status", "active");

      const { data: cardRecords } = await supabase
        .from("credit_cards")
        .select("credit_limit, min_payment_type, min_payment_value")
        .eq("user_id", user.id)
        .eq("is_active", true);

      const totalMinPayments = (debtRecords ?? []).reduce((s, d) => s + (d.monthly_payment ?? 0), 0)
        + (cardRecords ?? []).reduce((s, c) => {
          if (c.min_payment_type === "flat") return s + (c.min_payment_value ?? 0);
          if (c.min_payment_type === "percentage") return s + ((cardBalances[c.credit_limit] ?? 0) * (c.min_payment_value ?? 0));
          return s;
        }, 0);

      const totalIncome = avgSalary + avgFreelance;
      const dtiRatio = totalIncome > 0 ? totalMinPayments / totalIncome : 0;

      // Aggregate credit utilisation
      const { data: allCards } = await supabase
        .from("credit_cards")
        .select("id, credit_limit")
        .eq("user_id", user.id)
        .eq("is_active", true);

      const totalLimit = (allCards ?? []).reduce((s, c) => s + c.credit_limit, 0);
      const totalOutstanding = Object.values(cardBalances).reduce((s, b) => s + Math.max(0, b), 0);
      const aggUtil = totalLimit > 0 ? totalOutstanding / totalLimit : 0;

      // Safe to spend: load current month allocation
      const { data: allocation } = await supabase
        .from("monthly_allocations")
        .select("safe_to_spend")
        .eq("user_id", user.id)
        .eq("month", currentMonthStart)
        .eq("status", "approved")
        .limit(1)
        .single();

      const safeToSpend = allocation?.safe_to_spend ?? null;

      // Upsert snapshot
      await supabase.from("financial_health_snapshots").upsert({
        user_id: user.id,
        snapshot_date: today,
        monthly_survival_cost: survivalCost,
        freelance_buffer_months: bufferMonths,
        debt_to_income_ratio: dtiRatio,
        aggregate_credit_utilisation: aggUtil,
        safe_to_spend: safeToSpend,
        avg_monthly_salary: avgSalary,
        avg_monthly_freelance: avgFreelance,
        freelance_consistency_score: consistencyScore,
        net_worth: netWorth,
      }, { onConflict: "user_id,snapshot_date" });

      results.push(`✓ ${user.id}: net_worth=${netWorth.toFixed(0)}, buffer=${bufferMonths.toFixed(1)}mo`);
    } catch (err) {
      results.push(`✗ ${user.id}: ${err}`);
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
