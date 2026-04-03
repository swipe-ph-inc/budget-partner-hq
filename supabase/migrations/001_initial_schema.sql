-- ============================================================
-- Budget Partner HQ — Initial Schema Migration
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- CURRENCIES
-- ============================================================
CREATE TABLE currencies (
  code TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  exchange_rate_to_base NUMERIC(15, 6) DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed common currencies
INSERT INTO currencies (code, symbol, name, exchange_rate_to_base) VALUES
  ('PHP', '₱', 'Philippine Peso', 1),
  ('USD', '$', 'US Dollar', 56.5),
  ('EUR', '€', 'Euro', 61.2),
  ('GBP', '£', 'British Pound', 71.8),
  ('JPY', '¥', 'Japanese Yen', 0.38),
  ('SGD', 'S$', 'Singapore Dollar', 42.1),
  ('AUD', 'A$', 'Australian Dollar', 37.5),
  ('CNY', '¥', 'Chinese Yuan', 7.8),
  ('HKD', 'HK$', 'Hong Kong Dollar', 7.25),
  ('KRW', '₩', 'South Korean Won', 0.042);

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  base_currency TEXT DEFAULT 'PHP' REFERENCES currencies(code),
  date_format TEXT DEFAULT 'YYYY-MM-DD',
  first_day_of_week INT DEFAULT 1 CHECK (first_day_of_week BETWEEN 0 AND 6),
  timezone TEXT DEFAULT 'Asia/Manila',
  theme TEXT CHECK (theme IN ('light', 'dark', 'system')) DEFAULT 'system',
  plan TEXT CHECK (plan IN ('free', 'pro')) DEFAULT 'free',
  plan_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- PROMPT SETTINGS
-- ============================================================
CREATE TABLE prompt_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  system_prompt_prefix TEXT,
  ai_personality TEXT DEFAULT 'professional',
  response_language TEXT DEFAULT 'en',
  preferred_currency_display TEXT DEFAULT 'symbol',
  enable_proactive_alerts BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE prompt_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prompt_settings_all" ON prompt_settings USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES categories(id),
  color TEXT,
  icon TEXT,
  type TEXT CHECK (type IN ('income', 'expense', 'both')) DEFAULT 'expense',
  budget_amount NUMERIC(15, 4),
  is_survival BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_all" ON categories USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- MERCHANTS
-- ============================================================
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  logo_url TEXT,
  website TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchants_all" ON merchants USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- ACCOUNTS
-- ============================================================
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('savings', 'checking', 'ewallet', 'cash')) NOT NULL,
  institution TEXT,
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  balance NUMERIC(15, 4) DEFAULT 0,
  color TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_all" ON accounts USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CREDIT CARDS
-- ============================================================
CREATE TABLE credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  last_four TEXT,
  network TEXT CHECK (network IN ('visa', 'mastercard', 'amex', 'jcb', 'other')),
  credit_limit NUMERIC(15, 4) NOT NULL,
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  billing_cycle_start_day INT CHECK (billing_cycle_start_day BETWEEN 1 AND 28),
  payment_due_day INT CHECK (payment_due_day BETWEEN 1 AND 28),
  min_payment_type TEXT CHECK (min_payment_type IN ('flat', 'percentage')),
  min_payment_value NUMERIC(15, 4),
  color TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_cards_all" ON credit_cards USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CREDIT CARD STATEMENTS
-- ============================================================
CREATE TABLE credit_card_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  statement_balance NUMERIC(15, 4) NOT NULL,
  minimum_payment NUMERIC(15, 4),
  paid_amount NUMERIC(15, 4) DEFAULT 0,
  is_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE credit_card_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "statements_all" ON credit_card_statements
  USING (EXISTS (SELECT 1 FROM credit_cards c WHERE c.id = credit_card_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM credit_cards c WHERE c.id = credit_card_id AND c.user_id = auth.uid()));

-- ============================================================
-- INSTALMENT PLANS
-- ============================================================
CREATE TABLE instalment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_card_id UUID REFERENCES credit_cards(id) ON DELETE CASCADE NOT NULL,
  source_transaction_id UUID,
  description TEXT NOT NULL,
  total_amount NUMERIC(15, 4) NOT NULL,
  months INT NOT NULL,
  monthly_amount NUMERIC(15, 4) NOT NULL,
  interest_rate NUMERIC(5, 4) DEFAULT 0,
  processing_fee NUMERIC(15, 4) DEFAULT 0,
  processing_fee_charged_on DATE,
  start_month DATE NOT NULL,
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE instalment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "instalment_plans_all" ON instalment_plans
  USING (EXISTS (SELECT 1 FROM credit_cards c WHERE c.id = credit_card_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM credit_cards c WHERE c.id = credit_card_id AND c.user_id = auth.uid()));

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  provider TEXT,
  billing_cycle TEXT CHECK (billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly')) NOT NULL,
  amount NUMERIC(15, 4) NOT NULL,
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  fee_amount NUMERIC(15, 4) DEFAULT 0,
  payment_method_type TEXT CHECK (payment_method_type IN ('credit_card', 'account')) NOT NULL,
  credit_card_id UUID REFERENCES credit_cards(id),
  account_id UUID REFERENCES accounts(id),
  category_id UUID REFERENCES categories(id),
  next_billing_date DATE NOT NULL,
  last_billed_date DATE,
  auto_log_transaction BOOLEAN DEFAULT TRUE,
  status TEXT CHECK (status IN ('active', 'paused', 'cancelled')) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_all" ON subscriptions USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- DEBTS
-- ============================================================
CREATE TABLE debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('personal_loan', 'government_loan', 'informal', 'other')) NOT NULL,
  lender_name TEXT,
  original_amount NUMERIC(15, 4) NOT NULL,
  current_balance NUMERIC(15, 4) NOT NULL,
  interest_rate NUMERIC(5, 4) DEFAULT 0,
  monthly_payment NUMERIC(15, 4),
  payment_due_day INT,
  start_date DATE,
  expected_end_date DATE,
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  linked_account_id UUID REFERENCES accounts(id),
  notes TEXT,
  status TEXT CHECK (status IN ('active', 'paid_off', 'paused')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debts_all" ON debts USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- DEBT PAYMENTS
-- ============================================================
CREATE TABLE debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID REFERENCES debts(id) ON DELETE CASCADE NOT NULL,
  transaction_id UUID,
  amount NUMERIC(15, 4) NOT NULL,
  date DATE NOT NULL,
  principal_portion NUMERIC(15, 4),
  interest_portion NUMERIC(15, 4),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debt_payments_all" ON debt_payments
  USING (EXISTS (SELECT 1 FROM debts d WHERE d.id = debt_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM debts d WHERE d.id = debt_id AND d.user_id = auth.uid()));

-- ============================================================
-- DEBT STRATEGIES
-- ============================================================
CREATE TABLE debt_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  recommended_method TEXT CHECK (recommended_method IN ('avalanche', 'snowball', 'hybrid')),
  chosen_method TEXT CHECK (chosen_method IN ('avalanche', 'snowball', 'hybrid')),
  recommendation_reasoning TEXT,
  extra_monthly_payment NUMERIC(15, 4) DEFAULT 0,
  plan_data JSONB,
  last_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE debt_strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debt_strategies_all" ON debt_strategies USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- DEBT STRATEGY EVALUATIONS
-- ============================================================
CREATE TABLE debt_strategy_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  trigger TEXT CHECK (trigger IN ('new_debt', 'debt_paid', 'quarterly', 'buffer_change', 'manual')),
  recommended_method TEXT,
  reasoning TEXT,
  avalanche_payoff_date DATE,
  avalanche_total_interest NUMERIC(15, 4),
  snowball_payoff_date DATE,
  snowball_total_interest NUMERIC(15, 4),
  accepted BOOLEAN
);

ALTER TABLE debt_strategy_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debt_strategy_evals_all" ON debt_strategy_evaluations USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  invoice_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_address TEXT,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  subtotal NUMERIC(15, 4),
  tax_rate NUMERIC(5, 4) DEFAULT 0,
  tax_amount NUMERIC(15, 4),
  discount_amount NUMERIC(15, 4) DEFAULT 0,
  total NUMERIC(15, 4),
  status TEXT CHECK (status IN ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled')) DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_all" ON invoices USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- INVOICE LINE ITEMS
-- ============================================================
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 4) NOT NULL,
  unit_price NUMERIC(15, 4) NOT NULL,
  total NUMERIC(15, 4) NOT NULL
);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "line_items_all" ON invoice_line_items
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.user_id = auth.uid()));

-- ============================================================
-- SAVINGS PLANS
-- ============================================================
CREATE TABLE savings_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  target_amount NUMERIC(15, 4) NOT NULL,
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  target_date DATE,
  linked_account_id UUID REFERENCES accounts(id),
  current_amount NUMERIC(15, 4) DEFAULT 0,
  color TEXT,
  icon TEXT,
  notes TEXT,
  is_achieved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE savings_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "savings_plans_all" ON savings_plans USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- SAVINGS CONTRIBUTIONS
-- ============================================================
CREATE TABLE savings_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  savings_plan_id UUID REFERENCES savings_plans(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(15, 4) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE savings_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contributions_all" ON savings_contributions
  USING (EXISTS (SELECT 1 FROM savings_plans sp WHERE sp.id = savings_plan_id AND sp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM savings_plans sp WHERE sp.id = savings_plan_id AND sp.user_id = auth.uid()));

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense', 'transfer', 'credit_payment', 'credit_charge')) NOT NULL,
  income_type TEXT CHECK (income_type IN ('salary', 'freelance', 'other')),
  is_collected BOOLEAN DEFAULT TRUE,
  date DATE NOT NULL,
  amount NUMERIC(15, 4) NOT NULL,
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  fee_amount NUMERIC(15, 4) DEFAULT 0,
  fee_currency_code TEXT REFERENCES currencies(code),
  fee_category_id UUID REFERENCES categories(id),
  from_account_id UUID REFERENCES accounts(id),
  to_account_id UUID REFERENCES accounts(id),
  credit_card_id UUID REFERENCES credit_cards(id),
  category_id UUID REFERENCES categories(id),
  merchant_id UUID REFERENCES merchants(id),
  description TEXT,
  reference_number TEXT,
  tags TEXT[],
  attachment_url TEXT,
  linked_transaction_id UUID REFERENCES transactions(id),
  instalment_plan_id UUID REFERENCES instalment_plans(id),
  subscription_id UUID REFERENCES subscriptions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_all" ON transactions USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_type ON transactions(user_id, type);
CREATE INDEX idx_transactions_account ON transactions(from_account_id, to_account_id);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC(15, 4) NOT NULL,
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  category_id UUID REFERENCES categories(id),
  merchant_id UUID REFERENCES merchants(id),
  account_id UUID REFERENCES accounts(id),
  credit_card_id UUID REFERENCES credit_cards(id),
  description TEXT,
  receipt_url TEXT,
  tags TEXT[],
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT,
  instalment_plan_id UUID REFERENCES instalment_plans(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_all" ON expenses USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_expenses_user_date ON expenses(user_id, date DESC);

-- ============================================================
-- FINANCIAL HEALTH SNAPSHOTS
-- ============================================================
CREATE TABLE financial_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  snapshot_date DATE NOT NULL,
  monthly_survival_cost NUMERIC(15, 4),
  freelance_buffer_months NUMERIC(5, 2),
  debt_to_income_ratio NUMERIC(5, 4),
  aggregate_credit_utilisation NUMERIC(5, 4),
  safe_to_spend NUMERIC(15, 4),
  avg_monthly_salary NUMERIC(15, 4),
  avg_monthly_freelance NUMERIC(15, 4),
  freelance_consistency_score NUMERIC(3, 2),
  net_worth NUMERIC(15, 4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE financial_health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshots_all" ON financial_health_snapshots USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- MONTHLY ALLOCATIONS
-- ============================================================
CREATE TABLE monthly_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  month DATE NOT NULL,
  trigger_type TEXT CHECK (trigger_type IN ('salary', 'windfall', 'manual')),
  trigger_transaction_id UUID REFERENCES transactions(id),
  total_income_received NUMERIC(15, 4),
  total_obligations NUMERIC(15, 4),
  total_goals NUMERIC(15, 4),
  safe_to_spend NUMERIC(15, 4),
  status TEXT CHECK (status IN ('draft', 'approved', 'adjusted')) DEFAULT 'draft',
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, month, trigger_type)
);

ALTER TABLE monthly_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allocations_all" ON monthly_allocations USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- ALLOCATION ITEMS
-- ============================================================
CREATE TABLE allocation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID REFERENCES monthly_allocations(id) ON DELETE CASCADE NOT NULL,
  category TEXT CHECK (category IN ('obligation', 'goal', 'spending')) NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC(15, 4) NOT NULL,
  priority INT NOT NULL,
  linked_debt_id UUID REFERENCES debts(id),
  linked_credit_card_id UUID REFERENCES credit_cards(id),
  linked_account_id UUID REFERENCES accounts(id),
  linked_subscription_id UUID REFERENCES subscriptions(id),
  is_executed BOOLEAN DEFAULT FALSE,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE allocation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allocation_items_all" ON allocation_items
  USING (EXISTS (SELECT 1 FROM monthly_allocations ma WHERE ma.id = allocation_id AND ma.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM monthly_allocations ma WHERE ma.id = allocation_id AND ma.user_id = auth.uid()));

-- ============================================================
-- AI CHAT MESSAGES
-- ============================================================
CREATE TABLE ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant', 'tool')) NOT NULL,
  content TEXT,
  tool_calls JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_messages_all" ON ai_chat_messages USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_chat_messages_user ON ai_chat_messages(user_id, created_at DESC);

-- ============================================================
-- TRIGGERS — updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_debts_updated_at BEFORE UPDATE ON debts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_debt_strategies_updated_at BEFORE UPDATE ON debt_strategies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_monthly_allocations_updated_at BEFORE UPDATE ON monthly_allocations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_prompt_settings_updated_at BEFORE UPDATE ON prompt_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TRIGGER — Auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, base_currency, theme)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), 'PHP', 'system');

  INSERT INTO prompt_settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TRIGGER — Account balance update from transactions
-- ============================================================
CREATE OR REPLACE FUNCTION recalc_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  acct_id UUID;
BEGIN
  -- Determine which accounts to recalculate
  IF TG_OP = 'DELETE' THEN
    acct_id := OLD.from_account_id;
  ELSE
    acct_id := COALESCE(NEW.from_account_id, NEW.to_account_id);
  END IF;

  -- Recalculate from_account balance
  IF acct_id IS NOT NULL THEN
    UPDATE accounts SET balance = (
      SELECT COALESCE(
        SUM(CASE
          WHEN type = 'income' AND to_account_id = acct_id THEN amount
          WHEN type = 'transfer' AND to_account_id = acct_id THEN amount
          WHEN type = 'credit_payment' AND to_account_id = acct_id THEN amount
          WHEN type = 'expense' AND from_account_id = acct_id THEN -(amount + fee_amount)
          WHEN type = 'transfer' AND from_account_id = acct_id THEN -(amount + fee_amount)
          WHEN type = 'credit_payment' AND from_account_id = acct_id THEN -(amount + fee_amount)
          ELSE 0
        END), 0
      )
      FROM transactions
      WHERE user_id = (SELECT user_id FROM accounts WHERE id = acct_id)
        AND is_collected = TRUE
        AND (from_account_id = acct_id OR to_account_id = acct_id)
    )
    WHERE id = acct_id;
  END IF;

  -- If transfer, also recalculate to_account
  IF TG_OP != 'DELETE' AND NEW.to_account_id IS NOT NULL AND NEW.to_account_id != acct_id THEN
    UPDATE accounts SET balance = (
      SELECT COALESCE(
        SUM(CASE
          WHEN type = 'income' AND to_account_id = NEW.to_account_id THEN amount
          WHEN type = 'transfer' AND to_account_id = NEW.to_account_id THEN amount
          WHEN type = 'credit_payment' AND to_account_id = NEW.to_account_id THEN amount
          WHEN type = 'expense' AND from_account_id = NEW.to_account_id THEN -(amount + fee_amount)
          WHEN type = 'transfer' AND from_account_id = NEW.to_account_id THEN -(amount + fee_amount)
          WHEN type = 'credit_payment' AND from_account_id = NEW.to_account_id THEN -(amount + fee_amount)
          ELSE 0
        END), 0
      )
      FROM transactions
      WHERE user_id = (SELECT user_id FROM accounts WHERE id = NEW.to_account_id)
        AND is_collected = TRUE
        AND (from_account_id = NEW.to_account_id OR to_account_id = NEW.to_account_id)
    )
    WHERE id = NEW.to_account_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transaction_balance
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION recalc_account_balance();

-- ============================================================
-- TRIGGER — Savings plan current_amount from contributions
-- ============================================================
CREATE OR REPLACE FUNCTION recalc_savings_amount()
RETURNS TRIGGER AS $$
DECLARE
  plan_id UUID;
BEGIN
  plan_id := COALESCE(NEW.savings_plan_id, OLD.savings_plan_id);

  UPDATE savings_plans SET current_amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM savings_contributions
    WHERE savings_plan_id = plan_id
  )
  WHERE id = plan_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_savings_contributions
  AFTER INSERT OR UPDATE OR DELETE ON savings_contributions
  FOR EACH ROW EXECUTE FUNCTION recalc_savings_amount();

-- ============================================================
-- FUNCTION — Dashboard summary RPC
-- ============================================================
CREATE OR REPLACE FUNCTION get_dashboard_summary(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'accounts', (
      SELECT jsonb_agg(a ORDER BY a.type, a.name)
      FROM accounts a WHERE a.user_id = p_user_id AND a.is_active = TRUE
    ),
    'credit_cards', (
      SELECT jsonb_agg(c ORDER BY c.name)
      FROM credit_cards c WHERE c.user_id = p_user_id AND c.is_active = TRUE
    ),
    'recent_transactions', (
      SELECT jsonb_agg(t ORDER BY t.date DESC, t.created_at DESC)
      FROM (SELECT * FROM transactions WHERE user_id = p_user_id ORDER BY date DESC, created_at DESC LIMIT 10) t
    ),
    'savings_plans', (
      SELECT jsonb_agg(s ORDER BY s.created_at)
      FROM savings_plans s WHERE s.user_id = p_user_id AND s.is_achieved = FALSE
    ),
    'active_subscriptions', (
      SELECT jsonb_agg(sub ORDER BY sub.next_billing_date)
      FROM subscriptions sub WHERE sub.user_id = p_user_id AND sub.status = 'active'
    ),
    'active_debts', (
      SELECT jsonb_agg(d ORDER BY d.interest_rate DESC)
      FROM debts d WHERE d.user_id = p_user_id AND d.status = 'active'
    ),
    'health_snapshot', (
      SELECT to_jsonb(h) FROM financial_health_snapshots h
      WHERE h.user_id = p_user_id ORDER BY h.snapshot_date DESC LIMIT 1
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
