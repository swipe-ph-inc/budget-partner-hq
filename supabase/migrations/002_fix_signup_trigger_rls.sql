-- Signup failed with "Database error saving new user" because handle_new_user()
-- runs in a trigger with no JWT: auth.uid() is NULL, so RLS checks like
-- auth.uid() = id evaluate to NULL (not TRUE) and block the INSERT.
--
-- Allow the SECURITY DEFINER trigger role (migration owner) to insert alongside
-- normal authenticated self-service rules.

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id
    OR current_user IN (
      'postgres',
      'supabase_admin',
      'supabase_auth_admin'
    )
  );

DROP POLICY IF EXISTS "prompt_settings_all" ON prompt_settings;
CREATE POLICY "prompt_settings_all" ON prompt_settings
  USING (
    auth.uid() = user_id
    OR current_user IN (
      'postgres',
      'supabase_admin',
      'supabase_auth_admin'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR current_user IN (
      'postgres',
      'supabase_admin',
      'supabase_auth_admin'
    )
  );

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, display_name, base_currency, theme)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'PHP',
    'system'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO prompt_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
