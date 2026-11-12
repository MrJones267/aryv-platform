-- =====================================================================
-- Migration 044: Which phone a launch sign-up uses
-- Author: Oabona-Majoko
-- Created: 2026-11-13
--
-- Purpose:
--   The website's launch sign-up form now asks, optionally, whether the
--   visitor uses Android or iPhone, so we can see how many people wait on
--   each store. NULL means they did not say.
--
--   New nullable column; existing rows and code are unaffected. Safe to
--   re-run, and safe to apply before the code that uses it.
-- =====================================================================

ALTER TABLE launch_signups
  ADD COLUMN IF NOT EXISTS platform VARCHAR(10);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'launch_signups_platform_known'
  ) THEN
    ALTER TABLE launch_signups
      ADD CONSTRAINT launch_signups_platform_known CHECK (platform IN ('android', 'ios'));
  END IF;
END $$;
