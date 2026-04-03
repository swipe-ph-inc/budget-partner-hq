-- Distinguish Pro monthly vs Pro annual for UI and future billing webhooks.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_interval text
  CHECK (plan_interval IS NULL OR plan_interval IN ('monthly', 'annual'));

COMMENT ON COLUMN public.profiles.plan_interval IS 'When plan is pro: monthly or annual billing; null for free or legacy Pro rows.';
