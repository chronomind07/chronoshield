-- ============================================================
-- ChronoShield — Migration 003: Dark Web & Credits
-- Run this in Supabase SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- CREDITS (one row per user, tracks monthly allowance)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credits (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    plan                TEXT NOT NULL DEFAULT 'trial',
    credits_available   INTEGER NOT NULL DEFAULT 0 CHECK (credits_available >= 0),
    credits_used        INTEGER NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
    -- Date when credits reset (1st of next month)
    reset_date          DATE NOT NULL DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month')::DATE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own credits"
    ON public.credits FOR SELECT USING (auth.uid() = user_id);

-- Trigger: update updated_at
CREATE OR REPLACE FUNCTION update_credits_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER credits_updated_at
    BEFORE UPDATE ON public.credits
    FOR EACH ROW EXECUTE FUNCTION update_credits_updated_at();

-- ────────────────────────────────────────────────────────────
-- DARK WEB RESULTS
-- One row per scan (email breach, domain breach, typosquatting)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dark_web_results (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- 'email_breach' | 'domain_breach' | 'typosquatting'
    scan_type       TEXT NOT NULL,
    -- The value searched (email address or domain)
    query_value     TEXT,
    total_results   INTEGER DEFAULT 0,
    -- Full JSON payload from InsecureWeb
    results         JSONB DEFAULT '[]'::JSONB,
    is_manual       BOOLEAN DEFAULT FALSE,
    scanned_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dark_web_results_user_id ON public.dark_web_results(user_id);
CREATE INDEX idx_dark_web_results_scan_type ON public.dark_web_results(scan_type);
CREATE INDEX idx_dark_web_results_scanned_at ON public.dark_web_results(scanned_at DESC);

ALTER TABLE public.dark_web_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own dark web results"
    ON public.dark_web_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert dark web results"
    ON public.dark_web_results FOR INSERT WITH CHECK (TRUE);

-- ────────────────────────────────────────────────────────────
-- INSECUREWEB ORGS (for typosquatting — Business plan only)
-- Maps our users to InsecureWeb organization IDs
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.insecureweb_orgs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    insecureweb_org_id  BIGINT NOT NULL,
    org_name            TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.insecureweb_orgs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own iw org"
    ON public.insecureweb_orgs FOR SELECT USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- AUTO-INIT CREDITS when new subscription is created/updated
-- Called from backend; also create credits row on user signup
-- ────────────────────────────────────────────────────────────

-- Initialise credits for a user (upsert-safe)
-- plan: 'starter' → 5, 'business' → 20, else 0
CREATE OR REPLACE FUNCTION init_user_credits(p_user_id UUID, p_plan TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_credits INTEGER := CASE p_plan WHEN 'starter' THEN 5 WHEN 'business' THEN 20 ELSE 0 END;
BEGIN
    INSERT INTO public.credits (user_id, plan, credits_available, credits_used, reset_date)
    VALUES (
        p_user_id, p_plan, v_credits, 0,
        (date_trunc('month', NOW()) + INTERVAL '1 month')::DATE
    )
    ON CONFLICT (user_id) DO UPDATE SET
        plan = p_plan,
        credits_available = GREATEST(public.credits.credits_available,
                             CASE p_plan WHEN 'starter' THEN 5 WHEN 'business' THEN 20 ELSE 0 END),
        updated_at = NOW();
END; $$;
