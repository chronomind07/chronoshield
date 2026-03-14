-- ============================================================
-- ChronoShield — Demo user setup for testing
-- Run this in Supabase SQL Editor after migration 003
-- Sets demo@chronoshield.eu → Business plan + 50 credits
-- ============================================================

DO $$
DECLARE
    v_user_id UUID;
    v_reset_date DATE := (date_trunc('month', NOW()) + INTERVAL '1 month')::DATE;
BEGIN
    -- Resolve user_id from auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = 'demo@chronoshield.eu'
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User demo@chronoshield.eu not found. Create the account first.';
        RETURN;
    END IF;

    RAISE NOTICE 'Found user: %', v_user_id;

    -- ── Subscription: Business plan ───────────────────────────────────────
    INSERT INTO public.subscriptions (
        user_id, plan, status, max_domains, max_emails
    )
    VALUES (v_user_id, 'business', 'active', 3, 30)
    ON CONFLICT (user_id) DO UPDATE SET
        plan        = 'business',
        status      = 'active',
        max_domains = 3,
        max_emails  = 30,
        updated_at  = NOW();

    RAISE NOTICE 'Subscription set to Business';

    -- ── Credits: 50 available ─────────────────────────────────────────────
    INSERT INTO public.credits (
        user_id, plan, credits_available, credits_used, reset_date
    )
    VALUES (v_user_id, 'business', 50, 0, v_reset_date)
    ON CONFLICT (user_id) DO UPDATE SET
        plan               = 'business',
        credits_available  = 50,
        credits_used       = 0,
        reset_date         = v_reset_date,
        updated_at         = NOW();

    RAISE NOTICE 'Credits set to 50';

    RAISE NOTICE '✅ Demo user setup complete: demo@chronoshield.eu → Business + 50 credits';
END $$;

-- Verify
SELECT
    u.email,
    s.plan,
    s.status,
    s.max_domains,
    s.max_emails,
    c.credits_available,
    c.credits_used,
    c.reset_date
FROM auth.users u
JOIN public.subscriptions s ON s.user_id = u.id
LEFT JOIN public.credits c ON c.user_id = u.id
WHERE u.email = 'demo@chronoshield.eu';
