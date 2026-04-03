export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          base_currency: string;
          date_format: string;
          first_day_of_week: number;
          timezone: string;
          theme: "light" | "dark" | "system";
          plan: "free" | "pro";
          plan_expires_at: string | null;
          /** When plan is pro: billing cadence; null for free or legacy Pro. */
          plan_interval: "monthly" | "annual" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      prompt_settings: {
        Row: {
          id: string;
          user_id: string;
          system_prompt_prefix: string | null;
          ai_personality: string;
          response_language: string;
          preferred_currency_display: string;
          enable_proactive_alerts: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["prompt_settings"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["prompt_settings"]["Row"]>;
      };
      currencies: {
        Row: {
          code: string;
          symbol: string;
          name: string;
          exchange_rate_to_base: number;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["currencies"]["Row"], "updated_at">;
        Update: Partial<Database["public"]["Tables"]["currencies"]["Row"]>;
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: "savings" | "checking" | "ewallet" | "cash";
          institution: string | null;
          currency_code: string;
          balance: number;
          color: string | null;
          icon: string | null;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["accounts"]["Row"]> & {
          user_id: string; name: string; type: "savings" | "checking" | "ewallet" | "cash"; currency_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["accounts"]["Row"]>;
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          parent_id: string | null;
          color: string | null;
          icon: string | null;
          type: "income" | "expense" | "both";
          budget_amount: number | null;
          is_survival: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["categories"]["Row"]> & { user_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["categories"]["Row"]>;
      };
      merchants: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          category_id: string | null;
          logo_url: string | null;
          website: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["merchants"]["Row"]> & { user_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["merchants"]["Row"]>;
      };
      credit_cards: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          last_four: string | null;
          network: "visa" | "mastercard" | "amex" | "jcb" | "other" | null;
          credit_limit: number;
          currency_code: string;
          billing_cycle_start_day: number | null;
          payment_due_day: number | null;
          min_payment_type: "flat" | "percentage" | null;
          min_payment_value: number | null;
          color: string | null;
          is_active: boolean;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["credit_cards"]["Row"]> & {
          user_id: string; name: string; credit_limit: number; currency_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["credit_cards"]["Row"]>;
      };
      credit_card_statements: {
        Row: {
          id: string;
          credit_card_id: string;
          period_start: string;
          period_end: string;
          due_date: string;
          statement_balance: number;
          minimum_payment: number | null;
          paid_amount: number;
          is_paid: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["credit_card_statements"]["Row"]> & {
          credit_card_id: string; period_start: string; period_end: string; due_date: string; statement_balance: number;
        };
        Update: Partial<Database["public"]["Tables"]["credit_card_statements"]["Row"]>;
      };
      instalment_plans: {
        Row: {
          id: string;
          credit_card_id: string;
          source_transaction_id: string | null;
          description: string;
          total_amount: number;
          months: number;
          monthly_amount: number;
          interest_rate: number;
          processing_fee: number;
          processing_fee_charged_on: string | null;
          start_month: string;
          currency_code: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["instalment_plans"]["Row"]> & {
          credit_card_id: string; description: string; total_amount: number; months: number; monthly_amount: number; start_month: string; currency_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["instalment_plans"]["Row"]>;
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: "income" | "expense" | "transfer" | "credit_payment" | "credit_charge";
          income_type: "salary" | "freelance" | "other" | null;
          is_collected: boolean;
          date: string;
          amount: number;
          currency_code: string;
          fee_amount: number;
          fee_currency_code: string | null;
          fee_category_id: string | null;
          from_account_id: string | null;
          to_account_id: string | null;
          credit_card_id: string | null;
          category_id: string | null;
          merchant_id: string | null;
          description: string | null;
          reference_number: string | null;
          tags: string[] | null;
          attachment_url: string | null;
          linked_transaction_id: string | null;
          instalment_plan_id: string | null;
          subscription_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["transactions"]["Row"]> & {
          user_id: string; type: "income" | "expense" | "transfer" | "credit_payment" | "credit_charge"; date: string; amount: number; currency_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Row"]>;
      };
      expenses: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          amount: number;
          currency_code: string;
          category_id: string | null;
          merchant_id: string | null;
          account_id: string | null;
          credit_card_id: string | null;
          description: string | null;
          receipt_url: string | null;
          tags: string[] | null;
          is_recurring: boolean;
          recurrence_rule: string | null;
          instalment_plan_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["expenses"]["Row"]> & {
          user_id: string; date: string; amount: number; currency_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Row"]>;
      };
      savings_plans: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          target_amount: number;
          currency_code: string;
          target_date: string | null;
          linked_account_id: string | null;
          current_amount: number;
          color: string | null;
          icon: string | null;
          notes: string | null;
          is_achieved: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["savings_plans"]["Row"]> & {
          user_id: string; name: string; target_amount: number; currency_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["savings_plans"]["Row"]>;
      };
      savings_contributions: {
        Row: {
          id: string;
          savings_plan_id: string;
          amount: number;
          date: string;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["savings_contributions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["savings_contributions"]["Row"]>;
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          provider: string | null;
          billing_cycle: "weekly" | "monthly" | "quarterly" | "yearly";
          amount: number;
          currency_code: string;
          fee_amount: number;
          payment_method_type: "credit_card" | "account";
          credit_card_id: string | null;
          account_id: string | null;
          category_id: string | null;
          next_billing_date: string;
          last_billed_date: string | null;
          auto_log_transaction: boolean;
          status: "active" | "paused" | "cancelled";
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]> & {
          user_id: string; name: string; billing_cycle: "weekly" | "monthly" | "quarterly" | "yearly";
          amount: number; currency_code: string; payment_method_type: "credit_card" | "account"; next_billing_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]>;
      };
      debts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: "personal_loan" | "government_loan" | "informal" | "other";
          lender_name: string | null;
          original_amount: number;
          current_balance: number;
          interest_rate: number;
          monthly_payment: number | null;
          payment_due_day: number | null;
          start_date: string | null;
          expected_end_date: string | null;
          currency_code: string;
          linked_account_id: string | null;
          notes: string | null;
          status: "active" | "paid_off" | "paused";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["debts"]["Row"]> & {
          user_id: string; name: string;
          type: "personal_loan" | "government_loan" | "informal" | "other";
          original_amount: number; current_balance: number; currency_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["debts"]["Row"]>;
      };
      debt_payments: {
        Row: {
          id: string;
          debt_id: string;
          transaction_id: string | null;
          amount: number;
          date: string;
          principal_portion: number | null;
          interest_portion: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["debt_payments"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["debt_payments"]["Row"]>;
      };
      debt_strategies: {
        Row: {
          id: string;
          user_id: string;
          recommended_method: "avalanche" | "snowball" | "hybrid" | null;
          chosen_method: "avalanche" | "snowball" | "hybrid" | null;
          recommendation_reasoning: string | null;
          extra_monthly_payment: number;
          plan_data: Json | null;
          last_evaluated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["debt_strategies"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["debt_strategies"]["Row"]>;
      };
      debt_strategy_evaluations: {
        Row: {
          id: string;
          user_id: string;
          evaluated_at: string;
          trigger: "new_debt" | "debt_paid" | "quarterly" | "buffer_change" | "manual";
          recommended_method: string | null;
          reasoning: string | null;
          avalanche_payoff_date: string | null;
          avalanche_total_interest: number | null;
          snowball_payoff_date: string | null;
          snowball_total_interest: number | null;
          accepted: boolean | null;
        };
        Insert: Partial<Database["public"]["Tables"]["debt_strategy_evaluations"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["debt_strategy_evaluations"]["Row"]>;
      };
      invoices: {
        Row: {
          id: string;
          user_id: string;
          invoice_number: string;
          client_name: string;
          client_email: string | null;
          client_address: string | null;
          issue_date: string;
          due_date: string;
          currency_code: string;
          subtotal: number | null;
          tax_rate: number;
          tax_amount: number | null;
          discount_amount: number;
          total: number | null;
          status: "draft" | "sent" | "partial" | "paid" | "overdue" | "cancelled";
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["invoices"]["Row"]> & {
          user_id: string; invoice_number: string; client_name: string; issue_date: string; due_date: string; currency_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Row"]>;
      };
      invoice_line_items: {
        Row: {
          id: string;
          invoice_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          total: number;
        };
        Insert: Omit<Database["public"]["Tables"]["invoice_line_items"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["invoice_line_items"]["Row"]>;
      };
      financial_health_snapshots: {
        Row: {
          id: string;
          user_id: string;
          snapshot_date: string;
          monthly_survival_cost: number | null;
          freelance_buffer_months: number | null;
          debt_to_income_ratio: number | null;
          aggregate_credit_utilisation: number | null;
          safe_to_spend: number | null;
          avg_monthly_salary: number | null;
          avg_monthly_freelance: number | null;
          freelance_consistency_score: number | null;
          net_worth: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["financial_health_snapshots"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["financial_health_snapshots"]["Row"]>;
      };
      monthly_allocations: {
        Row: {
          id: string;
          user_id: string;
          month: string;
          trigger_type: "salary" | "windfall" | "manual";
          trigger_transaction_id: string | null;
          total_income_received: number | null;
          total_obligations: number | null;
          total_goals: number | null;
          safe_to_spend: number | null;
          status: "draft" | "approved" | "adjusted";
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["monthly_allocations"]["Row"]> & { user_id: string; month: string };
        Update: Partial<Database["public"]["Tables"]["monthly_allocations"]["Row"]>;
      };
      allocation_items: {
        Row: {
          id: string;
          allocation_id: string;
          category: "obligation" | "goal" | "spending";
          label: string;
          amount: number;
          priority: number;
          linked_debt_id: string | null;
          linked_credit_card_id: string | null;
          linked_account_id: string | null;
          linked_subscription_id: string | null;
          is_executed: boolean;
          executed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["allocation_items"]["Row"]> & {
          allocation_id: string; category: "obligation" | "goal" | "spending"; label: string; amount: number; priority: number;
        };
        Update: Partial<Database["public"]["Tables"]["allocation_items"]["Row"]>;
      };
      ai_chat_messages: {
        Row: {
          id: string;
          user_id: string;
          role: "user" | "assistant" | "tool";
          content: string | null;
          tool_calls: Json | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_chat_messages"]["Row"]> & {
          user_id: string; role: "user" | "assistant" | "tool";
        };
        Update: Partial<Database["public"]["Tables"]["ai_chat_messages"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
