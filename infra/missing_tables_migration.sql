-- ============================================================
-- ChronoShield — Missing Tables Migration (idempotent)
-- Safe to run on fresh DB or on a DB where some tables already
-- exist with an older/partial schema.
--
-- Strategy per table:
--   1. CREATE TABLE IF NOT EXISTS  → no-op if table exists
--   2. ALTER TABLE ADD COLUMN IF NOT EXISTS  → adds any missing
--      columns even when CREATE was skipped
--   3. CREATE INDEX IF NOT EXISTS  → safe re-run
--   4. RLS + policy (DROP IF EXISTS first)
-- ============================================================


-- ============================================================
-- DARK WEB SCAN RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dark_web_results (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_id        UUID REFERENCES public.monitored_emails(id) ON DELETE SET NULL,
    domain_id       UUID REFERENCES public.domains(id) ON DELETE SET NULL,
    scan_type       TEXT NOT NULL DEFAULT 'email',
    scanned_at      TIMESTAMPTZ DEFAULT NOW(),
    findings_count  INT NOT NULL DEFAULT 0,
    findings        JSONB,
    notified        BOOLEAN DEFAULT FALSE
);

-- Backfill any columns missing from a pre-existing table
ALTER TABLE public.dark_web_results ADD COLUMN IF NOT EXISTS email_id        UUID REFERENCES public.monitored_emails(id) ON DELETE SET NULL;
ALTER TABLE public.dark_web_results ADD COLUMN IF NOT EXISTS domain_id       UUID REFERENCES public.domains(id) ON DELETE SET NULL;
ALTER TABLE public.dark_web_results ADD COLUMN IF NOT EXISTS scan_type       TEXT NOT NULL DEFAULT 'email';
ALTER TABLE public.dark_web_results ADD COLUMN IF NOT EXISTS scanned_at      TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.dark_web_results ADD COLUMN IF NOT EXISTS findings_count  INT NOT NULL DEFAULT 0;
ALTER TABLE public.dark_web_results ADD COLUMN IF NOT EXISTS findings        JSONB;
ALTER TABLE public.dark_web_results ADD COLUMN IF NOT EXISTS notified        BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_dark_web_results_user_id    ON public.dark_web_results(user_id);
CREATE INDEX IF NOT EXISTS idx_dark_web_results_scanned_at ON public.dark_web_results(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_dark_web_results_email_id   ON public.dark_web_results(email_id);

ALTER TABLE public.dark_web_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_dark_web" ON public.dark_web_results;
CREATE POLICY "own_dark_web" ON public.dark_web_results FOR ALL USING (auth.uid() = user_id);


-- ============================================================
-- STRIPE EVENTS (idempotency — webhook deduplication)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stripe_events (
    event_id    TEXT PRIMARY KEY,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stripe_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- No RLS needed — backend writes via service role only.
-- Cleanup: DELETE FROM public.stripe_events WHERE created_at < NOW() - INTERVAL '90 days';


-- ============================================================
-- EXTENSION DAILY USAGE (Chrome extension per-user daily quota)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.extension_daily_usage (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    usage_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    scan_count  INT  NOT NULL DEFAULT 0,
    UNIQUE(user_id, usage_date)
);

ALTER TABLE public.extension_daily_usage ADD COLUMN IF NOT EXISTS usage_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.extension_daily_usage ADD COLUMN IF NOT EXISTS scan_count INT  NOT NULL DEFAULT 0;

-- Recreate unique constraint as index (idempotent alternative to ADD CONSTRAINT)
CREATE UNIQUE INDEX IF NOT EXISTS ext_usage_user_date_uniq
    ON public.extension_daily_usage(user_id, usage_date);

CREATE INDEX IF NOT EXISTS idx_ext_usage_user_date
    ON public.extension_daily_usage(user_id, usage_date);

ALTER TABLE public.extension_daily_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_ext_usage" ON public.extension_daily_usage;
CREATE POLICY "own_ext_usage" ON public.extension_daily_usage FOR ALL USING (auth.uid() = user_id);


-- ============================================================
-- CREDITS (monthly credit balance per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.credits (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    balance       INT  NOT NULL DEFAULT 0 CHECK (balance >= 0),
    plan_label    TEXT,
    last_reset_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS balance       INT  NOT NULL DEFAULT 0;
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS plan_label    TEXT;
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_credits_user_id ON public.credits(user_id);

ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_credits" ON public.credits;
CREATE POLICY "own_credits" ON public.credits FOR ALL USING (auth.uid() = user_id);


-- ============================================================
-- REPORTS (generated security reports metadata)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reports (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    domain_id     UUID REFERENCES public.domains(id) ON DELETE SET NULL,
    report_type   TEXT NOT NULL DEFAULT 'manual',
    generated_at  TIMESTAMPTZ DEFAULT NOW(),
    period_start  TIMESTAMPTZ,
    period_end    TIMESTAMPTZ,
    report_data   JSONB,
    nis2_compliant BOOLEAN
);

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS domain_id      UUID REFERENCES public.domains(id) ON DELETE SET NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS report_type    TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS generated_at   TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS period_start   TIMESTAMPTZ;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS period_end     TIMESTAMPTZ;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS report_data    JSONB;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS nis2_compliant BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_reports_user_id      ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_generated_at ON public.reports(generated_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_reports" ON public.reports;
CREATE POLICY "own_reports" ON public.reports FOR ALL USING (auth.uid() = user_id);


-- ============================================================
-- MITIGATION USAGE (ChronoAI chat monthly quota)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mitigation_usage (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    usage_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    usage_count INT  NOT NULL DEFAULT 0,
    UNIQUE(user_id, usage_date)
);

ALTER TABLE public.mitigation_usage ADD COLUMN IF NOT EXISTS usage_date  DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.mitigation_usage ADD COLUMN IF NOT EXISTS usage_count INT  NOT NULL DEFAULT 0;

-- Recreate unique constraint as index (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS mitigation_usage_user_date_uniq
    ON public.mitigation_usage(user_id, usage_date);

CREATE INDEX IF NOT EXISTS idx_mitigation_usage_user_date
    ON public.mitigation_usage(user_id, usage_date);

ALTER TABLE public.mitigation_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_mitigation_usage" ON public.mitigation_usage;
CREATE POLICY "own_mitigation_usage" ON public.mitigation_usage FOR ALL USING (auth.uid() = user_id);
