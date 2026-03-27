-- Migration 006: mitigation_usage table for AI mitigation assistant
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS mitigation_usage (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  alert_id   UUID        REFERENCES alerts(id) ON DELETE SET NULL,
  month      DATE        NOT NULL,
  count      INTEGER     DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique: one row per user per month
CREATE UNIQUE INDEX IF NOT EXISTS idx_mitigation_user_month
  ON mitigation_usage(user_id, month);

-- RLS
ALTER TABLE mitigation_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own mitigation usage"
  ON mitigation_usage FOR ALL
  USING (auth.uid() = user_id);
