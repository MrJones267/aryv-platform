-- =====================================================================
-- Migration 012: Dedicated phone-verification column
-- Author: Oabona-Majoko
-- Created: 2026-06-17
--
-- Problem:
--   The User model mapped `isPhoneVerified` to the `is_active` column, which
--   is ALSO used as the account active/inactive flag (see AdminUserController
--   user filtering). Phone verification was therefore meaningless: it defaulted
--   to TRUE and toggling it changed account-active state. This adds a real,
--   independent `is_phone_verified` column so verification means something.
-- =====================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_phone_verified ON users (is_phone_verified);

-- Note: existing `is_active` values are intentionally left untouched — they now
-- exclusively represent account active/inactive state. No back-fill of
-- is_phone_verified is performed; users must (re)verify their phone via OTP.
