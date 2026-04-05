-- Re-create handle_new_user to be fully robust.
--
-- Why this is needed:
--   Migration 010 dropped the prompt_settings table and updated the trigger,
--   but if the remote DB has any inconsistency the old trigger (which inserts
--   into the now-gone prompt_settings) causes "Database error saving new user"
--   for every OAuth / new sign-up attempt.
--
-- Changes vs the 010 version:
--   • ON CONFLICT (id) DO NOTHING — safe if a profile row somehow already exists
--   • EXCEPTION handler — trigger NEVER blocks user creation regardless of DB state
--   • Falls back to full_name (Google) then display_name then email prefix for display_name

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    display_name,
    base_currency,
    theme,
    ai_personality,
    response_language,
    preferred_currency_display,
    enable_proactive_alerts
  )
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'),    ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
      NULLIF(TRIM(split_part(NEW.email, '@', 1)),           '')
    ),
    'PHP',
    'system',
    'professional',
    'en',
    'symbol',
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but never let a trigger failure block user creation.
    RAISE WARNING 'handle_new_user: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- Ensure the trigger is attached (recreate idempotently)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
