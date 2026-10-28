-- =====================================================================
-- Migration 029: Let admin panel accounts review driver documents
-- Author: Oabona-Majoko
-- Created: 2026-10-28
--
-- Purpose:
--   driver_documents.reviewed_by references users(id). Admin panel
--   accounts live in admin_users, so recording an admin panel reviewer
--   fails the foreign key, and chk_driver_documents_decision_attributed
--   forbids leaving it empty on a decision. Documents could therefore not
--   be reviewed from the admin panel at all.
--
--   This drops the foreign key so reviewed_by can hold the id of whoever
--   decided: an admin_users id from the panel, or a users id from the older
--   /api/verification/admin routes. The CHECK that every decision is
--   attributed to someone stays.
--
--   The constraint has two possible names: migration 013 created it inline
--   (driver_documents_reviewed_by_fkey), and the cutover's schema builder
--   created foreign keys from model associations (fk_driver_documents_
--   reviewed_by). Every foreign key on the column is dropped, whatever it
--   is called. Safe to run where none exists.
-- =====================================================================

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = 'driver_documents'::regclass
       AND c.contype = 'f'
       AND a.attname = 'reviewed_by'
  LOOP
    EXECUTE format('ALTER TABLE driver_documents DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

COMMENT ON COLUMN driver_documents.reviewed_by IS
  'Who decided: an admin_users id (admin panel) or a users id (older admin routes). Not a foreign key.';
