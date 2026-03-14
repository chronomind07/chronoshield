-- ============================================================
-- ChronoShield — Migration 005: User Preferences
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── Add language + timezone to profiles ──────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/Madrid';

-- ── Add alert_medium + weekly_report to notification_preferences ─────────────
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS alert_medium  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS weekly_report BOOLEAN NOT NULL DEFAULT TRUE;
