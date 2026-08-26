-- =====================================================================
-- Migration 026: Disable the seeded administrator accounts
-- Author: Oabona-Majoko
-- Created: 2026-08-25
--
-- Purpose:
--   Migration 003 seeds two administrator accounts:
--
--     admin@aryv-app.com       role super_admin, permissions ["*"]
--     moderator@aryv-app.com   role moderator
--
--   Both were given the bcrypt hash
--   $2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm, and the line
--   above it in that file says in plain text what it hashes: 'admin123'.
--
--   `aryv-platform` is a public repository. Migration 003 has been applied to
--   every environment, so unless someone changed those passwords by hand,
--   admin@aryv-app.com / admin123 is a working super-administrator login for
--   anyone who has read the repository — full access to user records, ride
--   history, dispute resolution, commission settings and manual payment
--   release. The admin panel's login form also used to arrive pre-filled with
--   exactly these credentials.
--
--   This does not attempt to guess who should have access. It removes the
--   known-bad credential and leaves account creation to a deliberate act.
--
-- Effect:
--   Any admin account STILL holding the published hash is deactivated and its
--   password replaced with an unusable value. An administrator who has already
--   set their own password has a different hash and is untouched — they keep
--   working through this migration.
--
--   The replacement is a bcrypt hash of 64 random bytes that were generated
--   and discarded. It is syntactically valid, so bcrypt.compare behaves
--   normally, and it can never be matched because its plaintext does not exist
--   anywhere.
--
-- After applying:
--   Create a real administrator (see docs/SECRET-ROTATION.md) and check
--   admin_users.last_login for sign-ins you cannot account for.
-- =====================================================================

-- Conditional on the table existing. `admin_users` is created by migration
-- 003, and a database baselined by `db:migrate baseline` has 003 recorded as
-- applied without ever having run it — production is one of those, and has no
-- admin tables at all. There is nothing to disable there, and failing would
-- block every later migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) THEN
    RAISE NOTICE 'admin_users does not exist; no seeded accounts to disable.';
    RETURN;
  END IF;

  UPDATE admin_users
  SET
    is_active     = false,
    password_hash = '$2a$12$Fh2DRm.L5KyZKZVS8cryBuMtPul5aztfW6Aje8.kvzsMmRnON3pvq',
    updated_at    = NOW()
  WHERE password_hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm';
END $$;

-- Leave a trace in the audit log if one exists, so this shows up alongside
-- ordinary administrative actions rather than only in migration history.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_audit_logs')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_users') THEN
    INSERT INTO admin_audit_logs (admin_user_id, action, resource_type, details, created_at)
    SELECT
      id,
      'account_disabled',
      'admin_user',
      jsonb_build_object(
        'reason', 'Seeded account used a password published in a public repository',
        'migration', '026_disable_seeded_admin_accounts.sql'
      ),
      NOW()
    FROM admin_users
    WHERE password_hash = '$2a$12$Fh2DRm.L5KyZKZVS8cryBuMtPul5aztfW6Aje8.kvzsMmRnON3pvq';
  END IF;
END $$;
