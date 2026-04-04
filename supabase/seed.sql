-- =============================================================================
-- Budget Partner HQ — seed: recurring BILL subscriptions (Netflix, ISP, etc.)
-- =============================================================================
-- Targets `public.subscriptions` — NOT the app Pro plan.
-- For Premium / Pro app features, use: npm run db:seed:premium  (see seed_premium.sql)
--
-- Before running:
--   1. Replace the email below with a real auth user (same as your login).
--   2. Ensure that user has at least one active account OR credit card (optional but
--      recommended so payment_method_type rows link correctly).
--
-- How to run:
--   • Local DB:  npm run db:seed   (same as: supabase db query -f supabase/seed.sql)
--   • Full reset: supabase db reset   (runs migrations + seed.sql)
--   • Hosted: paste into Supabase Dashboard → SQL Editor, or:
--             supabase db query -f supabase/seed.sql --linked
--
-- Idempotent: removes previous rows inserted by this seed (notes contain [BPHQ_SEED]).
-- =============================================================================

DO $$
DECLARE
  v_user uuid;
  v_account uuid;
  v_card uuid;
  v_cat uuid;
  v_today date := CURRENT_DATE;
BEGIN
  -- ▼▼▼ EDIT THIS EMAIL ▼▼▼
  SELECT id INTO v_user
  FROM auth.users
  WHERE email = 'REPLACE_WITH_YOUR_EMAIL@example.com'
  LIMIT 1;

  IF v_user IS NULL THEN
    RAISE NOTICE 'subscription seed skipped: no auth.users row for REPLACE_WITH_YOUR_EMAIL@example.com — edit supabase/seed.sql';
    RETURN;
  END IF;

  SELECT a.id INTO v_account
  FROM public.accounts a
  WHERE a.user_id = v_user AND COALESCE(a.is_active, true)
  ORDER BY a.created_at
  LIMIT 1;

  SELECT c.id INTO v_card
  FROM public.credit_cards c
  WHERE c.user_id = v_user AND COALESCE(c.is_active, true)
  ORDER BY c.created_at
  LIMIT 1;

  SELECT cat.id INTO v_cat
  FROM public.categories cat
  WHERE cat.user_id = v_user
  ORDER BY cat.created_at
  LIMIT 1;

  DELETE FROM public.subscriptions s
  WHERE s.user_id = v_user
    AND s.notes IS NOT NULL
    AND s.notes LIKE '%[BPHQ_SEED]%';

  -- Active — monthly (card)
  IF v_card IS NOT NULL THEN
    INSERT INTO public.subscriptions (
      user_id, name, provider, billing_cycle, amount, currency_code, fee_amount,
      payment_method_type, credit_card_id, account_id, category_id,
      next_billing_date, last_billed_date, auto_log_transaction, status, notes
    ) VALUES (
      v_user,
      'Netflix',
      'Netflix Inc.',
      'monthly',
      549.00,
      'PHP',
      0,
      'credit_card',
      v_card,
      NULL,
      v_cat,
      v_today + 5,
      v_today - 25,
      false,
      'active',
      'Streaming [BPHQ_SEED]'
    );

    INSERT INTO public.subscriptions (
      user_id, name, provider, billing_cycle, amount, currency_code, fee_amount,
      payment_method_type, credit_card_id, account_id, category_id,
      next_billing_date, last_billed_date, auto_log_transaction, status, notes
    ) VALUES (
      v_user,
      'Spotify Premium',
      'Spotify',
      'monthly',
      199.00,
      'PHP',
      0,
      'credit_card',
      v_card,
      NULL,
      v_cat,
      v_today + 12,
      v_today - 18,
      false,
      'active',
      'Music [BPHQ_SEED]'
    );
  END IF;

  -- Active — monthly (bank account)
  IF v_account IS NOT NULL THEN
    INSERT INTO public.subscriptions (
      user_id, name, provider, billing_cycle, amount, currency_code, fee_amount,
      payment_method_type, credit_card_id, account_id, category_id,
      next_billing_date, last_billed_date, auto_log_transaction, status, notes
    ) VALUES (
      v_user,
      'Internet / Fiber',
      'ISP',
      'monthly',
      1699.00,
      'PHP',
      0,
      'account',
      NULL,
      v_account,
      v_cat,
      v_today + 3,
      v_today - 27,
      false,
      'active',
      'Utilities [BPHQ_SEED]'
    );

    INSERT INTO public.subscriptions (
      user_id, name, provider, billing_cycle, amount, currency_code, fee_amount,
      payment_method_type, credit_card_id, account_id, category_id,
      next_billing_date, last_billed_date, auto_log_transaction, status, notes
    ) VALUES (
      v_user,
      'iCloud+',
      'Apple',
      'monthly',
      49.00,
      'PHP',
      0,
      'account',
      NULL,
      v_account,
      v_cat,
      v_today + 20,
      v_today - 10,
      false,
      'active',
      'Cloud storage [BPHQ_SEED]'
    );
  END IF;

  -- Quarterly (card if available)
  IF v_card IS NOT NULL THEN
    INSERT INTO public.subscriptions (
      user_id, name, provider, billing_cycle, amount, currency_code, fee_amount,
      payment_method_type, credit_card_id, account_id, category_id,
      next_billing_date, last_billed_date, auto_log_transaction, status, notes
    ) VALUES (
      v_user,
      'Domain & email',
      'Registrar',
      'quarterly',
      1200.00,
      'PHP',
      50.00,
      'credit_card',
      v_card,
      NULL,
      v_cat,
      v_today + 45,
      v_today - 40,
      false,
      'active',
      'Web stack [BPHQ_SEED]'
    );
  END IF;

  -- Yearly
  IF v_account IS NOT NULL THEN
    INSERT INTO public.subscriptions (
      user_id, name, provider, billing_cycle, amount, currency_code, fee_amount,
      payment_method_type, credit_card_id, account_id, category_id,
      next_billing_date, last_billed_date, auto_log_transaction, status, notes
    ) VALUES (
      v_user,
      'Annual software license',
      'Vendor Co.',
      'yearly',
      12000.00,
      'PHP',
      0,
      'account',
      NULL,
      v_account,
      v_cat,
      v_today + 120,
      v_today - 245,
      false,
      'active',
      'Work tools [BPHQ_SEED]'
    );
  END IF;

  -- Paused & cancelled (for tab testing) — use account if present
  IF v_account IS NOT NULL THEN
    INSERT INTO public.subscriptions (
      user_id, name, provider, billing_cycle, amount, currency_code, fee_amount,
      payment_method_type, credit_card_id, account_id, category_id,
      next_billing_date, last_billed_date, auto_log_transaction, status, notes
    ) VALUES (
      v_user,
      'Old gym membership',
      'Gym',
      'monthly',
      899.00,
      'PHP',
      0,
      'account',
      NULL,
      v_account,
      v_cat,
      v_today + 60,
      NULL,
      false,
      'paused',
      'Paused example [BPHQ_SEED]'
    );

    INSERT INTO public.subscriptions (
      user_id, name, provider, billing_cycle, amount, currency_code, fee_amount,
      payment_method_type, credit_card_id, account_id, category_id,
      next_billing_date, last_billed_date, auto_log_transaction, status, notes
    ) VALUES (
      v_user,
      'Cancelled magazine',
      'Publisher',
      'monthly',
      299.00,
      'PHP',
      0,
      'account',
      NULL,
      v_account,
      v_cat,
      v_today + 90,
      v_today - 200,
      false,
      'cancelled',
      'Cancelled example [BPHQ_SEED]'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = v_user AND s.notes LIKE '%[BPHQ_SEED]%'
  ) THEN
    RAISE NOTICE 'subscription seed: no rows inserted — add at least one active account or credit card, then run this file again';
  ELSE
    RAISE NOTICE 'subscription seed: demo rows ready for user % (see /subscriptions)', v_user;
  END IF;
END $$;
