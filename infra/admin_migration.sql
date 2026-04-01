-- ============================================================
-- ChronoShield Admin Migration — run once in Supabase SQL Editor
-- ============================================================

-- Add role column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'superadmin'));

-- Set superadmin
UPDATE public.profiles
  SET role = 'superadmin'
  WHERE id = (SELECT id FROM auth.users WHERE email = 'support@chronoshield.eu');

-- Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action          TEXT NOT NULL,
    target_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    details         JSONB,
    ip_address      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Leads table
CREATE TABLE IF NOT EXISTS public.leads (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name    TEXT,
    domain          TEXT,
    email           TEXT,
    phone           TEXT,
    location        TEXT,
    industry        TEXT,
    spf_status      TEXT,
    dkim_status     TEXT,
    dmarc_status    TEXT,
    ssl_status      TEXT,
    score           INT,
    status          TEXT NOT NULL DEFAULT 'new'
                    CONSTRAINT leads_status_check
                    CHECK (status IN ('new', 'contacted', 'interested', 'converted', 'rejected')),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: profiles - users cannot change their own role
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"   ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update everything except role (enforced by WITH CHECK)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- admin_audit_log: no direct user access, only service role
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- leads: no direct user access, only service role
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON public.admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
