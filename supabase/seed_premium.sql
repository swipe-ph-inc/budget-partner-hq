-- =============================================================================
-- Premium / Pro plan test — simulates an active paid subscription (no PayMongo)
-- =============================================================================
-- Updates `public.profiles` so `isProSubscriber()` is true: unlocks AI, calendar,
-- savings, debts, invoices, full history, account limits, etc.
--
-- This does NOT insert payment records; it only sets plan fields like a successful
-- webhook would after checkout.
--
-- Before running:
--   1. Replace the email below with your login email (must exist in auth.users).
--   2. A profile row must exist (created on signup). This UPDATE targets profiles.id = user id.
--
-- Run:
--   npm run db:seed:premium
--   supabase db query -f supabase/seed_premium.sql --linked
--   Or paste into Supabase SQL Editor.
--
-- Revert to Free (optional):
--   UPDATE public.profiles
--   SET plan = 'free', plan_interval = NULL, plan_expires_at = NULL
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL' LIMIT 1);
-- =============================================================================

DO $$
DECLARE
  v_user uuid;
  -- 'monthly' | 'annual' — which Pro tier to simulate
  v_interval text := 'monthly';
BEGIN
  -- ▼▼▼ EDIT THIS EMAIL ▼▼▼
  SELECT id INTO v_user
  FROM auth.users
  WHERE email = 'REPLACE_WITH_YOUR_EMAIL@example.com'
  LIMIT 1;

  IF v_user IS NULL THEN
    RAISE NOTICE 'seed_premium: no user found — edit email in supabase/seed_premium.sql';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user) THEN
    RAISE NOTICE 'seed_premium: no profiles row for user % — complete signup first', v_user;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET
    plan = 'pro',
    plan_interval = v_interval::text,
    -- NULL = no expiry (always Pro for local testing). Use a future timestamp to test expiry.
    plan_expires_at = NULL
  WHERE id = v_user;

  RAISE NOTICE 'seed_premium: OK — user % is Pro (interval=%). Reload the app.', v_user, v_interval;
END $$;
