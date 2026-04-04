-- Track the PayMongo checkout session ID on the profile so the webhook
-- can correlate incoming events back to the correct user.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS paymongo_checkout_session_id TEXT;

COMMENT ON COLUMN public.profiles.paymongo_checkout_session_id
  IS 'Stores the pending PayMongo checkout session ID until the webhook confirms payment.';
