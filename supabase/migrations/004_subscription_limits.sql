-- Free tier: max 3 active accounts and 3 active credit cards (Pro unlimited).
-- Uses profiles.plan / plan_expires_at (see types/database.ts).

CREATE OR REPLACE FUNCTION public.is_pro_subscriber(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.plan = 'pro'
      AND (p.plan_expires_at IS NULL OR p.plan_expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION public.is_pro_subscriber(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pro_subscriber(uuid) TO authenticated;

DROP POLICY IF EXISTS "accounts_all" ON public.accounts;

CREATE POLICY "accounts_select" ON public.accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "accounts_update" ON public.accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts_delete" ON public.accounts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "accounts_insert" ON public.accounts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_pro_subscriber(auth.uid())
      OR (
        SELECT COUNT(*)::int FROM public.accounts a
        WHERE a.user_id = auth.uid() AND COALESCE(a.is_active, TRUE) IS TRUE
      ) < 3
    )
  );

DROP POLICY IF EXISTS "credit_cards_all" ON public.credit_cards;

CREATE POLICY "credit_cards_select" ON public.credit_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "credit_cards_update" ON public.credit_cards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "credit_cards_delete" ON public.credit_cards FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "credit_cards_insert" ON public.credit_cards FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_pro_subscriber(auth.uid())
      OR (
        SELECT COUNT(*)::int FROM public.credit_cards c
        WHERE c.user_id = auth.uid() AND COALESCE(c.is_active, TRUE) IS TRUE
      ) < 3
    )
  );
