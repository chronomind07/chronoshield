-- ============================================================
-- ChronoShield - Supabase Schema
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name       TEXT,
    company_name    TEXT,
    phone           TEXT,
    avatar_url      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TYPE subscription_plan AS ENUM ('starter', 'business', 'trial');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing', 'incomplete');

CREATE TABLE public.subscriptions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan                    subscription_plan NOT NULL DEFAULT 'trial',
    status                  subscription_status NOT NULL DEFAULT 'trialing',
    stripe_customer_id      TEXT UNIQUE,
    stripe_subscription_id  TEXT UNIQUE,
    stripe_price_id         TEXT,
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    cancel_at_period_end    BOOLEAN DEFAULT FALSE,
    max_domains             INT NOT NULL DEFAULT 1,
    max_emails              INT NOT NULL DEFAULT 10,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOMAINS
-- ============================================================
CREATE TABLE public.domains (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    domain          TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    verified        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, domain)
);

-- ============================================================
-- MONITORED EMAILS
-- ============================================================
CREATE TABLE public.monitored_emails (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, email)
);

-- ============================================================
-- BREACH SCAN RESULTS
-- ============================================================
CREATE TABLE public.breach_results (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id        UUID NOT NULL REFERENCES public.monitored_emails(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scanned_at      TIMESTAMPTZ DEFAULT NOW(),
    breaches_found  INT NOT NULL DEFAULT 0,
    breach_data     JSONB,           -- raw InsecureWeb response
    is_new          BOOLEAN DEFAULT TRUE,
    notified        BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- SSL SCAN RESULTS
-- ============================================================
CREATE TYPE ssl_status AS ENUM ('valid', 'expiring_soon', 'expired', 'invalid', 'no_ssl', 'error');

CREATE TABLE public.ssl_results (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain_id       UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scanned_at      TIMESTAMPTZ DEFAULT NOW(),
    status          ssl_status NOT NULL DEFAULT 'error',
    issuer          TEXT,
    subject         TEXT,
    valid_from      TIMESTAMPTZ,
    valid_until     TIMESTAMPTZ,
    days_remaining  INT,
    grade           CHAR(2),        -- A+, A, B, C, F
    error_msg       TEXT,
    notified        BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- UPTIME SCAN RESULTS
-- ============================================================
CREATE TYPE uptime_status AS ENUM ('up', 'down', 'degraded', 'error');

CREATE TABLE public.uptime_results (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain_id           UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    checked_at          TIMESTAMPTZ DEFAULT NOW(),
    status              uptime_status NOT NULL DEFAULT 'error',
    status_code         INT,
    response_time_ms    INT,
    error_msg           TEXT,
    notified            BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- EMAIL SECURITY SCAN RESULTS (SPF / DKIM / DMARC)
-- ============================================================
CREATE TYPE record_status AS ENUM ('valid', 'invalid', 'missing', 'error');

CREATE TABLE public.email_security_results (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain_id       UUID NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scanned_at      TIMESTAMPTZ DEFAULT NOW(),
    spf_status      record_status NOT NULL DEFAULT 'error',
    spf_record      TEXT,
    dkim_status     record_status NOT NULL DEFAULT 'error',
    dkim_record     TEXT,
    dmarc_status    record_status NOT NULL DEFAULT 'error',
    dmarc_record    TEXT,
    notified        BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- SECURITY SCORES
-- ============================================================
CREATE TABLE public.security_scores (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    domain_id       UUID REFERENCES public.domains(id) ON DELETE CASCADE,
    calculated_at   TIMESTAMPTZ DEFAULT NOW(),
    overall_score   INT NOT NULL DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),
    breach_score    INT NOT NULL DEFAULT 0 CHECK (breach_score BETWEEN 0 AND 100),
    ssl_score       INT NOT NULL DEFAULT 0 CHECK (ssl_score BETWEEN 0 AND 100),
    uptime_score    INT NOT NULL DEFAULT 0 CHECK (uptime_score BETWEEN 0 AND 100),
    email_sec_score INT NOT NULL DEFAULT 0 CHECK (email_sec_score BETWEEN 0 AND 100),
    grade           CHAR(2),        -- A+, A, B, C, D, F
    details         JSONB
);

-- ============================================================
-- AI ANALYSES
-- ============================================================
CREATE TABLE public.ai_analyses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    domain_id       UUID REFERENCES public.domains(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    context_type    TEXT NOT NULL,  -- 'full_report', 'ssl_alert', 'breach_alert', etc.
    input_data      JSONB NOT NULL,
    analysis        TEXT NOT NULL,  -- Claude's response
    tokens_used     INT,
    model           TEXT DEFAULT 'claude-haiku-4-5-20251001'
);

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TYPE alert_type AS ENUM ('breach', 'ssl_expiry', 'ssl_invalid', 'downtime', 'email_security', 'score_drop');
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');

CREATE TABLE public.alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    domain_id       UUID REFERENCES public.domains(id) ON DELETE SET NULL,
    email_id        UUID REFERENCES public.monitored_emails(id) ON DELETE SET NULL,
    alert_type      alert_type NOT NULL,
    severity        alert_severity NOT NULL DEFAULT 'warning',
    title           TEXT NOT NULL,
    message         TEXT NOT NULL,
    metadata        JSONB,
    sent_at         TIMESTAMPTZ DEFAULT NOW(),
    read_at         TIMESTAMPTZ,
    email_sent      BOOLEAN DEFAULT FALSE,
    archived        BOOLEAN DEFAULT FALSE
);
-- Migration: ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
-- Migration: ALTER TABLE public.domains ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ;

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE public.notification_preferences (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email_alerts            BOOLEAN DEFAULT TRUE,
    alert_breach            BOOLEAN DEFAULT TRUE,
    alert_ssl_expiry        BOOLEAN DEFAULT TRUE,
    alert_ssl_invalid       BOOLEAN DEFAULT TRUE,
    alert_downtime          BOOLEAN DEFAULT TRUE,
    alert_email_security    BOOLEAN DEFAULT TRUE,
    alert_score_drop        BOOLEAN DEFAULT TRUE,
    ssl_days_warning        INT DEFAULT 30,
    score_drop_threshold    INT DEFAULT 10,
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_domains_user_id ON public.domains(user_id);
CREATE INDEX idx_monitored_emails_user_id ON public.monitored_emails(user_id);
CREATE INDEX idx_breach_results_email_id ON public.breach_results(email_id);
CREATE INDEX idx_breach_results_scanned_at ON public.breach_results(scanned_at DESC);
CREATE INDEX idx_ssl_results_domain_id ON public.ssl_results(domain_id);
CREATE INDEX idx_ssl_results_scanned_at ON public.ssl_results(scanned_at DESC);
CREATE INDEX idx_uptime_results_domain_id ON public.uptime_results(domain_id);
CREATE INDEX idx_uptime_results_checked_at ON public.uptime_results(checked_at DESC);
CREATE INDEX idx_email_security_domain_id ON public.email_security_results(domain_id);
CREATE INDEX idx_security_scores_user_id ON public.security_scores(user_id);
CREATE INDEX idx_security_scores_domain_id ON public.security_scores(domain_id);
CREATE INDEX idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX idx_alerts_read_at ON public.alerts(read_at);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitored_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breach_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssl_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uptime_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_security_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies: users only see their own data
CREATE POLICY "own_profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "own_subscription" ON public.subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_domains" ON public.domains FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_emails" ON public.monitored_emails FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_breach" ON public.breach_results FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_ssl" ON public.ssl_results FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_uptime" ON public.uptime_results FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_email_sec" ON public.email_security_results FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_scores" ON public.security_scores FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_ai" ON public.ai_analyses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_alerts" ON public.alerts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_notif_prefs" ON public.notification_preferences FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile and subscription on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');

    INSERT INTO public.subscriptions (user_id, plan, status, max_domains, max_emails)
    VALUES (NEW.id, 'trial', 'trialing', 1, 10);

    INSERT INTO public.notification_preferences (user_id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_domains_updated_at BEFORE UPDATE ON public.domains
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
