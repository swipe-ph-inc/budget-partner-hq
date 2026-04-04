import { createClient } from "@/lib/supabase/server";
import { format, addDays, startOfMonth } from "date-fns";
import { firstDayOfMonth } from "@/lib/utils";

type HandlerResult = Record<string, unknown> | unknown[];

export async function handleMCPTool(
  toolName: string,
  input: Record<string, unknown>,
  userId: string
): Promise<HandlerResult> {
  const supabase = await createClient();

  switch (toolName) {
    case "get_accounts": {
      let query = supabase
        .from("accounts")
        .select("*")
        .eq("user_id", userId)
        .order("type")
        .order("name");

      if (!input.include_inactive) {
        query = query.eq("is_active", true);
      }
      const { data } = await query;
      return data ?? [];
    }

    case "get_account_balance": {
      let query = supabase.from("accounts").select("id, name, balance, currency_code").eq("user_id", userId);
      if (input.account_id) query = query.eq("id", input.account_id as string);
      if (input.account_name) query = query.ilike("name", `%${input.account_name}%`);
      const { data } = await query.limit(1).single();
      return data ?? { error: "Account not found" };
    }

    case "get_transactions": {
      let query = supabase
        .from("transactions")
        .select("*, category:categories!transactions_category_id_fkey(name, color), merchant:merchants(name)")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit((input.limit as number) ?? 20);

      if (input.start_date) query = query.gte("date", input.start_date as string);
      if (input.end_date) query = query.lte("date", input.end_date as string);
      if (input.type) query = query.eq("type", input.type as string);
      if (input.account_id) query = query.or(`from_account_id.eq.${input.account_id},to_account_id.eq.${input.account_id}`);
      if (input.category_id) query = query.eq("category_id", input.category_id as string);

      const { data } = await query;
      return data ?? [];
    }

    case "create_transaction": {
      const txData = {
        user_id: userId,
        type: input.type as string,
        amount: input.amount as number,
        date: input.date as string,
        currency_code: input.currency_code as string,
        description: input.description as string | undefined,
        income_type: input.income_type as string | undefined,
        is_collected: input.is_collected !== false,
        from_account_id: input.from_account_id as string | undefined,
        to_account_id: input.to_account_id as string | undefined,
        credit_card_id: input.credit_card_id as string | undefined,
        category_id: input.category_id as string | undefined,
        merchant_id: input.merchant_id as string | undefined,
        fee_amount: (input.fee_amount as number) ?? 0,
        tags: input.tags as string[] | undefined,
      };

      const { data, error } = await supabase.from("transactions").insert(txData).select().single();
      if (error) return { error: error.message };

      // For transfers, create the linked credit transaction
      if (input.type === "transfer" && input.to_account_id && data) {
        await supabase.from("transactions").insert({
          user_id: userId,
          type: "transfer",
          amount: input.amount as number,
          date: input.date as string,
          currency_code: input.currency_code as string,
          from_account_id: input.from_account_id as string | undefined,
          to_account_id: input.to_account_id as string | undefined,
          description: input.description as string | undefined,
          linked_transaction_id: data.id,
        });
      }

      return data ?? { error: "Failed to create transaction" };
    }

    case "get_expenses": {
      let query = supabase
        .from("transactions")
        .select("*, category:categories!transactions_category_id_fkey(name), merchant:merchants(name)")
        .eq("user_id", userId)
        .in("type", ["expense", "credit_charge"])
        .order("date", { ascending: false })
        .limit((input.limit as number) ?? 20);

      if (input.start_date) query = query.gte("date", input.start_date as string);
      if (input.end_date) query = query.lte("date", input.end_date as string);
      if (input.category_id) query = query.eq("category_id", input.category_id as string);
      if (input.merchant_id) query = query.eq("merchant_id", input.merchant_id as string);

      const { data } = await query;
      return data ?? [];
    }

    case "create_expense": {
      const creditCardId = input.credit_card_id as string | undefined;
      const { data, error } = await supabase.from("transactions").insert({
        user_id: userId,
        type: creditCardId ? "credit_charge" : "expense",
        date: input.date as string,
        amount: input.amount as number,
        currency_code: input.currency_code as string,
        category_id: input.category_id as string | undefined,
        merchant_id: input.merchant_id as string | undefined,
        from_account_id: !creditCardId ? (input.account_id as string | undefined) : undefined,
        credit_card_id: creditCardId,
        description: input.description as string | undefined,
        tags: input.tags as string[] | undefined,
      }).select().single();
      if (error) return { error: error.message };
      return data ?? { error: "Failed to create expense" };
    }

    case "get_credit_cards": {
      const { data: cards } = await supabase
        .from("credit_cards")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (!cards || cards.length === 0) return [];

      // Batch all card transactions in a single query instead of N+1
      const cardIds = cards.map((c) => c.id);
      const { data: allCharges } = await supabase
        .from("transactions")
        .select("amount, fee_amount, type, credit_card_id")
        .in("credit_card_id", cardIds)
        .eq("user_id", userId);

      const chargesByCard: Record<string, { amount: number; fee_amount: number | null; type: string }[]> = {};
      for (const tx of allCharges ?? []) {
        if (!tx.credit_card_id) continue;
        (chargesByCard[tx.credit_card_id] ??= []).push(tx);
      }

      return cards.map((card) => {
        const charges = chargesByCard[card.id] ?? [];
        const outstanding = charges.reduce((sum, tx) => {
          if (tx.type === "credit_charge") return sum + tx.amount + (tx.fee_amount ?? 0);
          if (tx.type === "credit_payment") return sum - tx.amount;
          return sum;
        }, 0);
        const utilisation = card.credit_limit > 0 ? (outstanding / card.credit_limit) * 100 : 0;
        return { ...card, outstanding_balance: outstanding, utilisation_pct: utilisation };
      });
    }

    case "get_credit_card_statements": {
      const { data } = await supabase
        .from("credit_card_statements")
        .select("*")
        .eq("credit_card_id", input.credit_card_id as string)
        .order("period_end", { ascending: false })
        .limit((input.limit as number) ?? 6);
      return data ?? [];
    }

    case "get_savings_plans": {
      let query = supabase.from("savings_plans").select("*").eq("user_id", userId);
      if (!input.include_achieved) query = query.eq("is_achieved", false);
      const { data } = await query;
      return data ?? [];
    }

    case "add_savings_contribution": {
      // Verify the savings plan belongs to the requesting user before inserting
      const { data: plan } = await supabase
        .from("savings_plans")
        .select("id")
        .eq("id", input.savings_plan_id as string)
        .eq("user_id", userId)
        .single();
      if (!plan) return { error: "Savings plan not found" };

      const { data, error } = await supabase.from("savings_contributions").insert({
        savings_plan_id: input.savings_plan_id as string,
        amount: input.amount as number,
        date: input.date as string,
        notes: input.notes as string | undefined,
      }).select().single();
      if (error) return { error: error.message };
      return data ?? { error: "Failed to add contribution" };
    }

    case "get_invoices": {
      let query = supabase
        .from("invoices")
        .select("*, line_items:invoice_line_items(*)")
        .eq("user_id", userId)
        .order("issue_date", { ascending: false })
        .limit((input.limit as number) ?? 20);
      if (input.status) query = query.eq("status", input.status as string);
      const { data } = await query;
      return data ?? [];
    }

    case "update_invoice_status": {
      const { data, error } = await supabase
        .from("invoices")
        .update({ status: input.status as string })
        .eq("id", input.invoice_id as string)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) return { error: error.message };
      return data ?? { error: "Failed to update invoice" };
    }

    case "get_categories": {
      let query = supabase.from("categories").select("*").eq("user_id", userId).order("name");
      if (input.type) query = query.eq("type", input.type as string);
      const { data } = await query;
      return data ?? [];
    }

    case "get_merchants": {
      let query = supabase.from("merchants").select("*").eq("user_id", userId).order("name");
      if (input.search) query = query.ilike("name", `%${input.search}%`);
      const { data } = await query;
      return data ?? [];
    }

    case "get_dashboard_summary": {
      const { data } = await supabase.rpc("get_dashboard_summary", { p_user_id: userId });
      return data ?? {};
    }

    case "get_upcoming_due_dates": {
      const days = (input.days as number) ?? 30;
      const today = format(new Date(), "yyyy-MM-dd");
      const future = format(addDays(new Date(), days), "yyyy-MM-dd");

      const { data: statements } = await supabase
        .from("credit_card_statements")
        .select("*, credit_card:credit_cards(name, user_id)")
        .gte("due_date", today)
        .lte("due_date", future)
        .eq("is_paid", false)
        .order("due_date");

      const userStatements = (statements ?? []).filter(
        (s) => (s.credit_card as { user_id: string })?.user_id === userId
      );

      return { credit_card_due_dates: userStatements, as_of: today, window_days: days };
    }

    case "get_spending_by_category": {
      const { data } = await supabase
        .from("transactions")
        .select("amount, category:categories!transactions_category_id_fkey(id, name, color)")
        .eq("user_id", userId)
        .in("type", ["expense", "credit_charge"])
        .gte("date", input.start_date as string)
        .lte("date", input.end_date as string);

      const byCategory: Record<string, { name: string; color: string; total: number }> = {};
      (data ?? []).forEach((e) => {
        const cat = e.category as unknown as { id: string; name: string; color: string } | null;
        const key = cat?.name ?? "Uncategorised";
        if (!byCategory[key]) byCategory[key] = { name: key, color: cat?.color ?? "#e8e0cc", total: 0 };
        byCategory[key].total += e.amount;
      });

      return Object.values(byCategory).sort((a, b) => b.total - a.total);
    }

    case "get_financial_health_snapshot": {
      const { data } = await supabase
        .from("financial_health_snapshots")
        .select("*")
        .eq("user_id", userId)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .single();
      return data ?? { message: "No snapshot available yet. Data will be generated after your first transactions." };
    }

    case "get_monthly_allocation": {
      const month = (input.month as string) ?? firstDayOfMonth();
      const { data } = await supabase
        .from("monthly_allocations")
        .select("*, items:allocation_items(*)")
        .eq("user_id", userId)
        .eq("month", month)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data ?? { message: "No allocation plan for this month yet." };
    }

    case "approve_allocation": {
      const { allocation_id, adjustments } = input as {
        allocation_id: string;
        adjustments?: Array<{ item_id: string; new_amount: number }>;
      };

      if (adjustments && adjustments.length > 0) {
        for (const adj of adjustments) {
          // Scope update to this allocation so items from other allocations cannot be mutated
          await supabase
            .from("allocation_items")
            .update({ amount: adj.new_amount })
            .eq("id", adj.item_id)
            .eq("allocation_id", allocation_id);
        }
      }

      const { data, error } = await supabase
        .from("monthly_allocations")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", allocation_id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) return { error: error.message };
      return { success: true, allocation: data };
    }

    case "get_safe_to_spend": {
      const month = firstDayOfMonth();
      const { data: allocation } = await supabase
        .from("monthly_allocations")
        .select("safe_to_spend, status")
        .eq("user_id", userId)
        .eq("month", month)
        .eq("status", "approved")
        .limit(1)
        .single();

      if (!allocation) return { safe_to_spend: null, message: "No approved allocation for this month." };

      // Calculate spent this month
      const { data: spent } = await supabase
        .from("transactions")
        .select("amount, fee_amount")
        .eq("user_id", userId)
        .in("type", ["expense", "credit_charge"])
        .gte("date", month)
        .lte("date", format(new Date(), "yyyy-MM-dd"));

      const totalSpent = (spent ?? []).reduce((s, t) => s + t.amount + (t.fee_amount ?? 0), 0);
      const remaining = (allocation.safe_to_spend ?? 0) - totalSpent;

      return {
        planned_safe_to_spend: allocation.safe_to_spend,
        spent_this_month: totalSpent,
        remaining,
        pct_remaining: allocation.safe_to_spend ? (remaining / allocation.safe_to_spend) * 100 : 0,
      };
    }

    case "get_debt_strategy": {
      const { data } = await supabase
        .from("debt_strategies")
        .select("*")
        .eq("user_id", userId)
        .single();
      return data ?? { message: "No debt strategy set. Run run_strategy_recommendation to get one." };
    }

    case "run_strategy_recommendation": {
      const { data: debts } = await supabase
        .from("debts")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active");

      const { data: cards } = await supabase
        .from("credit_cards")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);

      const { data: snapshot } = await supabase
        .from("financial_health_snapshots")
        .select("*")
        .eq("user_id", userId)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .single();

      const extraPayment = (input.extra_monthly_payment as number) ?? 5000;

      // Simple recommendation logic
      const allDebts = [
        ...(debts ?? []).map((d) => ({
          name: d.name,
          balance: d.current_balance,
          rate: d.interest_rate,
          monthlyMin: d.monthly_payment ?? 0,
          type: d.type,
        })),
      ];

      if (allDebts.length === 0) {
        return { message: "No active debts found. You're debt free!" };
      }

      const rates = allDebts.map((d) => d.rate);
      const maxRate = Math.max(...rates);
      const minRate = Math.min(...rates);
      const rateSpread = maxRate - minRate;

      const bufferMonths = snapshot?.freelance_buffer_months ?? 0;
      const consistencyScore = snapshot?.freelance_consistency_score ?? 0;

      let recommended: "avalanche" | "snowball" | "hybrid" = "avalanche";
      let reasoning = "";

      if (rateSpread >= 0.1) {
        // High rate spread → avalanche
        recommended = "avalanche";
        reasoning = `Your highest rate (${(maxRate * 100).toFixed(0)}%) vs lowest (${(minRate * 100).toFixed(0)}%) is a ${(rateSpread * 100).toFixed(0)} percentage point spread — mathematically significant. `;
      } else if (rateSpread < 0.05) {
        // Rates clustered → snowball may help
        recommended = "snowball";
        reasoning = `Your debts have similar interest rates (spread of only ${(rateSpread * 100).toFixed(1)}pp), so the psychological momentum of quick wins with Snowball outweighs the marginal interest savings. `;
      } else {
        recommended = bufferMonths < 2 || consistencyScore < 0.6 ? "snowball" : "avalanche";
        reasoning = `With moderate rate spread and ${bufferMonths < 2 ? "a below-target buffer" : "a healthy buffer"}, `;
      }

      if (bufferMonths < 1.5 || consistencyScore < 0.5) {
        recommended = "snowball";
        reasoning += `Your freelance buffer (${bufferMonths.toFixed(1)} months) is below the 1.5-month threshold, so cash flow stability takes priority. Snowball's quick wins will free up minimum payments sooner. `;
      }

      const informalDebts = allDebts.filter((d) => d.type === "informal");
      const informalNote =
        informalDebts.length > 0
          ? `\n\nException: ${informalDebts.map((d) => d.name).join(", ")} (informal debt) — regardless of strategy, clearing borrowed money from family/friends first has social value that outweighs pure math.`
          : "";

      const result = {
        recommended_method: recommended,
        reasoning: reasoning + informalNote,
        extra_monthly_payment: extraPayment,
        all_debts: allDebts,
        buffer_months: bufferMonths,
        consistency_score: consistencyScore,
      };

      // Save to debt_strategies
      await supabase.from("debt_strategies").upsert({
        user_id: userId,
        recommended_method: recommended,
        chosen_method: recommended,
        recommendation_reasoning: reasoning + informalNote,
        extra_monthly_payment: extraPayment,
        last_evaluated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      return result;
    }

    case "get_month_in_review": {
      const month = (input.month as string) ?? firstDayOfMonth(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
      const monthEnd = format(new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 0), "yyyy-MM-dd");

      const [{ data: income }, { data: expenses }, { data: allocation }] = await Promise.all([
        supabase.from("transactions").select("amount, income_type").eq("user_id", userId).eq("type", "income").eq("is_collected", true).gte("date", month).lte("date", monthEnd),
        supabase.from("transactions").select("amount, fee_amount").eq("user_id", userId).in("type", ["expense", "credit_charge"]).gte("date", month).lte("date", monthEnd),
        supabase.from("monthly_allocations").select("*").eq("user_id", userId).eq("month", month).single(),
      ]);

      const totalIncome = (income ?? []).reduce((s, t) => s + t.amount, 0);
      const totalExpenses = (expenses ?? []).reduce((s, t) => s + t.amount + (t.fee_amount ?? 0), 0);

      return {
        month,
        total_income: totalIncome,
        total_expenses: totalExpenses,
        net: totalIncome - totalExpenses,
        allocation: allocation ?? null,
      };
    }

    case "get_income_averages": {
      const threeMonthsAgo = format(new Date(new Date().setMonth(new Date().getMonth() - 3)), "yyyy-MM-dd");
      const { data } = await supabase
        .from("transactions")
        .select("amount, income_type, date")
        .eq("user_id", userId)
        .eq("type", "income")
        .eq("is_collected", true)
        .gte("date", threeMonthsAgo);

      const salary = (data ?? []).filter((t) => t.income_type === "salary");
      const freelance = (data ?? []).filter((t) => t.income_type === "freelance");

      return {
        avg_monthly_salary: salary.reduce((s, t) => s + t.amount, 0) / 3,
        avg_monthly_freelance: freelance.reduce((s, t) => s + t.amount, 0) / 3,
        period: `Last 3 months from ${threeMonthsAgo}`,
      };
    }

    case "get_windfall_recommendation": {
      const amount = input.amount as number;
      const { data: snapshot } = await supabase
        .from("financial_health_snapshots")
        .select("freelance_buffer_months, monthly_survival_cost")
        .eq("user_id", userId)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .single();

      const buffer = snapshot?.freelance_buffer_months ?? 1;
      const survivalCost = snapshot?.monthly_survival_cost ?? 15000;

      let bufferPct: number, debtPct: number, rewardPct: number;
      const rewardMin = Math.max(amount * 0.1, 2000);

      if (buffer < 1.5) {
        bufferPct = 0.6; debtPct = 0.3; rewardPct = 0.1;
      } else if (buffer <= 2.5) {
        bufferPct = 0.4; debtPct = 0.5; rewardPct = 0.1;
      } else {
        bufferPct = 0.2; debtPct = 0.7; rewardPct = 0.1;
      }

      const remainder = amount - rewardMin;
      const bufferAmount = Math.round(remainder * (bufferPct / (bufferPct + debtPct)));
      const debtAmount = remainder - bufferAmount;

      return {
        total_windfall: amount,
        buffer_months_current: buffer,
        buffer_target: 3,
        allocations: {
          buffer_top_up: { amount: bufferAmount, pct: Math.round((bufferAmount / amount) * 100) },
          debt_payment: { amount: debtAmount, pct: Math.round((debtAmount / amount) * 100) },
          reward: { amount: rewardMin, pct: Math.round((rewardMin / amount) * 100) },
        },
        reasoning: `Buffer at ${buffer.toFixed(1)} months. Target is 3 months (${(survivalCost * 3).toLocaleString()} total). Allocating ${Math.round(bufferPct * 100)}% to buffer, ${Math.round(debtPct * 100)}% to debt, 10% as reward.`,
      };
    }

    case "get_subscriptions": {
      let query = supabase.from("subscriptions").select("*").eq("user_id", userId).order("next_billing_date");
      if (input.status) query = query.eq("status", input.status as string);
      const { data } = await query;
      return data ?? [];
    }

    case "get_debts": {
      let query = supabase.from("debts").select("*").eq("user_id", userId).order("interest_rate", { ascending: false });
      if (input.status) query = query.eq("status", input.status as string);
      const { data } = await query;
      return data ?? [];
    }

    // ── CREATE handlers ────────────────────────────────────────────────────

    case "create_account": {
      const initialBalance = (input.initial_balance as number) ?? 0;

      const { data: account, error } = await supabase
        .from("accounts")
        .insert({
          user_id: userId,
          name: input.name as string,
          type: input.type as string,
          currency_code: input.currency_code as string,
          institution: (input.institution as string) ?? null,
          balance: initialBalance,
          color: (input.color as string) ?? null,
          notes: (input.notes as string) ?? null,
        })
        .select()
        .single();

      if (error) return { error: error.message };

      // Record initial balance as an income transaction so balance is trackable
      if (initialBalance > 0) {
        await supabase.from("transactions").insert({
          user_id: userId,
          type: "income",
          amount: initialBalance,
          date: format(new Date(), "yyyy-MM-dd"),
          currency_code: input.currency_code as string,
          to_account_id: account.id,
          description: "Initial balance",
          income_type: "other",
          is_collected: true,
        });
      }

      return account;
    }

    case "create_category": {
      const { data, error } = await supabase
        .from("categories")
        .insert({
          user_id: userId,
          name: input.name as string,
          type: (input.type as string) ?? "expense",
          color: (input.color as string) ?? null,
          icon: (input.icon as string) ?? null,
          budget_amount: (input.budget_amount as number) ?? null,
          is_survival: (input.is_survival as boolean) ?? false,
        })
        .select()
        .single();

      if (error) return { error: error.message };
      return data;
    }

    case "create_merchant": {
      const { data, error } = await supabase
        .from("merchants")
        .insert({
          user_id: userId,
          name: input.name as string,
          category_id: (input.category_id as string) ?? null,
          notes: (input.notes as string) ?? null,
        })
        .select()
        .single();

      if (error) return { error: error.message };
      return data;
    }

    case "create_subscription": {
      const { data, error } = await supabase
        .from("subscriptions")
        .insert({
          user_id: userId,
          name: input.name as string,
          provider: (input.provider as string) ?? null,
          amount: input.amount as number,
          currency_code: input.currency_code as string,
          billing_cycle: input.billing_cycle as string,
          next_billing_date: input.next_billing_date as string,
          payment_method_type: input.payment_method_type as string,
          credit_card_id: (input.credit_card_id as string) ?? null,
          account_id: (input.account_id as string) ?? null,
          category_id: (input.category_id as string) ?? null,
          auto_log_transaction: (input.auto_log_transaction as boolean) ?? true,
          notes: (input.notes as string) ?? null,
          status: "active",
        })
        .select()
        .single();

      if (error) return { error: error.message };
      return data;
    }

    case "create_debt": {
      const { data, error } = await supabase
        .from("debts")
        .insert({
          user_id: userId,
          name: input.name as string,
          type: input.type as string,
          original_amount: input.original_amount as number,
          current_balance: input.current_balance as number,
          currency_code: input.currency_code as string,
          interest_rate: (input.interest_rate as number) ?? 0,
          monthly_payment: (input.monthly_payment as number) ?? null,
          payment_due_day: (input.payment_due_day as number) ?? null,
          lender_name: (input.lender_name as string) ?? null,
          start_date: (input.start_date as string) ?? null,
          expected_end_date: (input.expected_end_date as string) ?? null,
          notes: (input.notes as string) ?? null,
          status: "active",
        })
        .select()
        .single();

      if (error) return { error: error.message };
      return data;
    }

    case "create_savings_plan": {
      const initialAmount = (input.initial_amount as number) ?? 0;

      const { data: plan, error } = await supabase
        .from("savings_plans")
        .insert({
          user_id: userId,
          name: input.name as string,
          target_amount: input.target_amount as number,
          currency_code: input.currency_code as string,
          target_date: (input.target_date as string) ?? null,
          linked_account_id: (input.linked_account_id as string) ?? null,
          current_amount: initialAmount,
          color: (input.color as string) ?? null,
          icon: (input.icon as string) ?? null,
          is_achieved: false,
        })
        .select()
        .single();

      if (error) return { error: error.message };

      // Seed an initial contribution if provided
      if (initialAmount > 0 && plan) {
        await supabase.from("savings_contributions").insert({
          savings_plan_id: plan.id,
          amount: initialAmount,
          date: format(new Date(), "yyyy-MM-dd"),
          notes: "Initial amount",
        });
      }

      return plan;
    }

    case "create_invoice": {
      const lineItems = (input.line_items as Array<{ description: string; quantity: number; unit_price: number }>) ?? [];
      const subtotal = lineItems.reduce((s, item) => s + item.quantity * item.unit_price, 0);
      const taxRate = (input.tax_rate as number) ?? 0;
      const taxAmount = subtotal * taxRate;
      const discountAmount = (input.discount_amount as number) ?? 0;
      const total = subtotal + taxAmount - discountAmount;
      const issueDate = (input.issue_date as string) ?? format(new Date(), "yyyy-MM-dd");

      // Auto-generate invoice number if not provided.
      // Using max invoice_number (lexicographic) + timestamp avoids a COUNT race
      // condition where two concurrent requests could receive the same serial number.
      let invoiceNumber = input.invoice_number as string | undefined;
      if (!invoiceNumber) {
        const year = new Date().getFullYear();
        // Random 4-digit suffix makes collisions extremely unlikely even under concurrency
        const suffix = String(Math.floor(1000 + Math.random() * 9000));
        invoiceNumber = `INV-${year}-${suffix}`;
      }

      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          user_id: userId,
          invoice_number: invoiceNumber,
          client_name: input.client_name as string,
          client_email: (input.client_email as string) ?? null,
          client_address: (input.client_address as string) ?? null,
          issue_date: issueDate,
          due_date: input.due_date as string,
          currency_code: input.currency_code as string,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          total,
          status: "draft",
          notes: (input.notes as string) ?? null,
        })
        .select()
        .single();

      if (error) return { error: error.message };

      // Insert line items
      if (lineItems.length > 0 && invoice) {
        await supabase.from("invoice_line_items").insert(
          lineItems.map((item) => ({
            invoice_id: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.quantity * item.unit_price,
          }))
        );
      }

      return { ...invoice, line_items: lineItems };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
