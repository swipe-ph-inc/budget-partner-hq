-- ============================================================
-- 010_schema_cleanup.sql
-- Removes unused tables and merges 1:1 tables for simplicity.
--
-- Changes:
--   1. DROP  debt_strategy_evaluations  (never queried)
--   2. DROP  currencies                  (never queried; remove FK constraints first)
--   3. MERGE prompt_settings → profiles  (1:1, always co-created)
--   4. MERGE expenses → transactions     (already unified in UI; add is_recurring/recurrence_rule)
-- ============================================================

-- ============================================================
-- 1. DROP debt_strategy_evaluations (unused audit log table)
-- ============================================================
DROP TABLE IF EXISTS debt_strategy_evaluations;

-- ============================================================
-- 2. Remove FK constraints to currencies, then drop currencies
--    Default Postgres FK names follow: {table}_{column}_fkey
-- ============================================================
ALTER TABLE profiles         DROP CONSTRAINT IF EXISTS profiles_base_currency_fkey;
ALTER TABLE accounts         DROP CONSTRAINT IF EXISTS accounts_currency_code_fkey;
ALTER TABLE credit_cards     DROP CONSTRAINT IF EXISTS credit_cards_currency_code_fkey;
ALTER TABLE instalment_plans DROP CONSTRAINT IF EXISTS instalment_plans_currency_code_fkey;
ALTER TABLE subscriptions    DROP CONSTRAINT IF EXISTS subscriptions_currency_code_fkey;
ALTER TABLE debts            DROP CONSTRAINT IF EXISTS debts_currency_code_fkey;
ALTER TABLE savings_plans    DROP CONSTRAINT IF EXISTS savings_plans_currency_code_fkey;
ALTER TABLE invoices         DROP CONSTRAINT IF EXISTS invoices_currency_code_fkey;
ALTER TABLE transactions     DROP CONSTRAINT IF EXISTS transactions_currency_code_fkey;
ALTER TABLE transactions     DROP CONSTRAINT IF EXISTS transactions_fee_currency_code_fkey;
-- Drop expenses FK so we can drop currencies before the expenses table is migrated away
ALTER TABLE expenses         DROP CONSTRAINT IF EXISTS expenses_currency_code_fkey;

DROP TABLE IF EXISTS currencies;

-- ============================================================
-- 3. MERGE prompt_settings → profiles
-- ============================================================

-- 3a. Add the AI-settings columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS system_prompt_prefix       TEXT,
  ADD COLUMN IF NOT EXISTS ai_personality             TEXT    NOT NULL DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS response_language          TEXT    NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS preferred_currency_display TEXT    NOT NULL DEFAULT 'symbol',
  ADD COLUMN IF NOT EXISTS enable_proactive_alerts    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ai_provider                TEXT    CHECK (ai_provider IN ('anthropic', 'openrouter')),
  ADD COLUMN IF NOT EXISTS ai_model                   TEXT;

-- 3b. Copy existing prompt_settings data into profiles
UPDATE profiles p
SET
  system_prompt_prefix       = ps.system_prompt_prefix,
  ai_personality             = COALESCE(ps.ai_personality, 'professional'),
  response_language          = COALESCE(ps.response_language, 'en'),
  preferred_currency_display = COALESCE(ps.preferred_currency_display, 'symbol'),
  enable_proactive_alerts    = COALESCE(ps.enable_proactive_alerts, TRUE),
  ai_provider                = ps.ai_provider,
  ai_model                   = ps.ai_model
FROM prompt_settings ps
WHERE ps.user_id = p.id;

-- 3c. Replace handle_new_user trigger — no longer inserts into prompt_settings
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (
    id, display_name, base_currency, theme,
    ai_personality, response_language, preferred_currency_display, enable_proactive_alerts
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'PHP',
    'system',
    'professional', 'en', 'symbol', TRUE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3d. Drop old updated_at trigger on prompt_settings (will fail gracefully if already gone)
DROP TRIGGER IF EXISTS trg_prompt_settings_updated_at ON prompt_settings;

-- 3e. Drop prompt_settings table
DROP TABLE IF EXISTS prompt_settings;

-- ============================================================
-- 4. MERGE expenses → transactions
-- ============================================================

-- 4a. Add recurring fields to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS is_recurring    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;

-- 4b. Migrate all expense rows into transactions
--     - If credit_card_id is set  → type = 'credit_charge'
--     - Otherwise                 → type = 'expense'
--     - account_id                → from_account_id
--     - receipt_url               → attachment_url (already exists on transactions)
INSERT INTO transactions (
  id, user_id, type, date, amount, currency_code,
  category_id, merchant_id,
  from_account_id, credit_card_id,
  description, attachment_url, tags,
  is_recurring, recurrence_rule,
  instalment_plan_id,
  is_collected,
  created_at
)
SELECT
  id,
  user_id,
  CASE WHEN credit_card_id IS NOT NULL THEN 'credit_charge' ELSE 'expense' END,
  date,
  amount,
  currency_code,
  category_id,
  merchant_id,
  CASE WHEN credit_card_id IS NULL THEN account_id ELSE NULL END,
  credit_card_id,
  description,
  receipt_url,
  tags,
  is_recurring,
  recurrence_rule,
  instalment_plan_id,
  TRUE,
  created_at
FROM expenses
ON CONFLICT (id) DO NOTHING;

-- 4c. Drop expenses table
DROP TABLE IF EXISTS expenses;
