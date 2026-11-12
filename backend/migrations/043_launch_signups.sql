-- =====================================================================
-- Migration 043: Launch sign-ups from the website
-- Author: Oabona-Majoko
-- Created: 2026-11-12
--
-- Purpose:
--   aryv-app.com asks visitors for an email address so we can tell them
--   when the app is out. Each address is kept once (stored lower-case),
--   and is used for that one message only. Nothing links it to a user.
--
--   New table; nothing else reads it. Safe to re-run, and safe to apply
--   before the code that uses it. The aryv_app role gets access through
--   the default privileges set in migration 038.
-- =====================================================================

CREATE TABLE IF NOT EXISTS launch_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(254) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT launch_signups_email_lower CHECK (email = lower(email))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_launch_signups_email ON launch_signups (email);
