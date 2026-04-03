-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES auth.users NOT NULL,
  type            TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  body            TEXT,
  link            TEXT,
  is_read         BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Prevents the same alert from being created twice for the same event.
  -- Format examples:
  --   subscription_due:{sub_id}:{YYYY-MM-DD}
  --   credit_card_due:{card_id}:{YYYY-MM}
  --   budget_overspent:{category_id}:{YYYY-MM}
  --   savings_milestone:{plan_id}:{pct}
  --   low_buffer:{YYYY-MM}
  --   high_credit_utilisation:{YYYY-MM}
  --   subscription_logged:{YYYY-MM-DD}
  deduplication_key TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_all" ON notifications
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- One notification per user per dedup key
CREATE UNIQUE INDEX notifications_dedup
  ON notifications (user_id, deduplication_key)
  WHERE deduplication_key IS NOT NULL;

CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread  ON notifications (user_id) WHERE is_read = FALSE;
