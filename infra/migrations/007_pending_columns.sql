-- Migration 007: Add pending columns
-- Safe to run multiple times (IF NOT EXISTS)

-- domains table
ALTER TABLE public.domains ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ;

-- monitored_emails table
ALTER TABLE public.monitored_emails ADD COLUMN IF NOT EXISTS spf_status TEXT;
ALTER TABLE public.monitored_emails ADD COLUMN IF NOT EXISTS dkim_status TEXT;
ALTER TABLE public.monitored_emails ADD COLUMN IF NOT EXISTS dmarc_status TEXT;
ALTER TABLE public.monitored_emails ADD COLUMN IF NOT EXISTS last_email_sec_scan_at TIMESTAMPTZ;

-- alerts table
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- stripe_events table for webhook idempotency
CREATE TABLE IF NOT EXISTS public.stripe_events (
    event_id TEXT PRIMARY KEY,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- dark_web_results table (if not exists)
CREATE TABLE IF NOT EXISTS public.dark_web_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scan_type TEXT NOT NULL,
    query_value TEXT,
    total_results INTEGER DEFAULT 0,
    results JSONB DEFAULT '[]',
    is_manual BOOLEAN DEFAULT FALSE,
    scanned_at TIMESTAMPTZ DEFAULT NOW()
);

-- credits table (if not exists)
CREATE TABLE IF NOT EXISTS public.credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    amount INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- extension_daily_usage table (if not exists)
CREATE TABLE IF NOT EXISTS public.extension_daily_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    request_count INTEGER DEFAULT 1,
    UNIQUE(user_id, usage_date)
);

-- RLS for new tables
ALTER TABLE public.dark_web_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can manage their own dark_web_results"
    ON public.dark_web_results FOR ALL USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can view their own credits"
    ON public.credits FOR ALL USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can view their own extension usage"
    ON public.extension_daily_usage FOR ALL USING (auth.uid() = user_id);
