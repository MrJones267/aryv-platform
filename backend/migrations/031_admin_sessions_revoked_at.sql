-- =====================================================================
-- Migration 031: Let an admin end every other session on their account
-- Author: Oabona-Majoko
-- Created: 2026-10-28
--
-- Purpose:
--   Admin tokens are JWTs. Signing out revoked only the one token used to
--   sign out, so a token left on another device, or stolen, stayed valid
--   for the rest of its life, even after the password was changed.
--
--   sessions_revoked_at is when the admin last ended their other sessions,
--   which changing the password also does. authenticateAdminToken refuses
--   any token issued before it. Null means nothing has been revoked.
-- =====================================================================

ALTER TABLE admin_users
    ADD COLUMN IF NOT EXISTS sessions_revoked_at TIMESTAMP WITH TIME ZONE NULL;

COMMENT ON COLUMN admin_users.sessions_revoked_at IS
  'Tokens issued before this moment are refused: set when the admin signs out other sessions or changes their password.';
