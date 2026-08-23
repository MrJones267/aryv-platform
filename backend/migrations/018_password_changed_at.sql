-- =====================================================================
-- Migration 018: Track when a password last changed
-- Author: Oabona-Majoko
-- Created: 2026-08-23
--
-- Purpose:
--   Changing or resetting a password did not end existing sessions. None of
--   the three paths — change, reset by email link, reset by OTP — cleared the
--   refresh token or invalidated issued access tokens.
--
--   So somebody who resets their password *because* their account was
--   compromised kept the attacker signed in: access tokens stayed valid for
--   their full 24-hour life, and the refresh token kept working indefinitely.
--   That is the one moment a password reset exists to protect.
--
--   Recording when the password changed lets authenticateToken refuse any
--   access token issued before that moment, which closes the window without
--   needing to enumerate and blacklist every outstanding token.
-- =====================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE NULL;

-- Existing rows stay NULL, which means "no known change" and lets every
-- current session continue. Backfilling to NOW() would sign every user out on
-- deploy, which is not what this is for.
COMMENT ON COLUMN users.password_changed_at IS
  'When the password was last changed. Access tokens issued before this are refused.';
