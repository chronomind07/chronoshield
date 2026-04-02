-- ── ChronoShield: Reports + NIS2 Migration ───────────────────────────────────
-- Run this once against your Supabase project.

-- ── reports table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type          TEXT NOT NULL CHECK (type IN ('weekly', 'monthly', 'manual')),
    period_start  TIMESTAMPTZ NOT NULL,
    period_end    TIMESTAMPTZ NOT NULL,
    data          JSONB,
    pdf_url       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reports_user_id_idx    ON reports (user_id);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports (created_at DESC);
CREATE INDEX IF NOT EXISTS reports_type_idx       ON reports (type);

-- ── Row-Level Security ────────────────────────────────────────────────────────
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_reports" ON reports
    FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service role (backend) bypasses RLS automatically.
