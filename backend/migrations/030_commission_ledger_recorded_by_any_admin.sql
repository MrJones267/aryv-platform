-- =====================================================================
-- Migration 030: Let admin panel accounts record commission payments
-- Author: Oabona-Majoko
-- Created: 2026-10-28
--
-- Purpose:
--   commission_ledger.recorded_by holds who recorded an entry. Migration 011
--   declared it REFERENCES users(id), but admin panel accounts live in
--   admin_users, so recording a driver's commission payment from the panel
--   would fail the foreign key wherever that constraint exists.
--
--   In production it most likely does not: 011 was baselined, and the table
--   was built from the models, which have no association on this column.
--   This drops any foreign key on the column, whatever it is named, so the
--   panel works in every environment. A no-op where none exists.
-- =====================================================================

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = 'commission_ledger'::regclass
       AND c.contype = 'f'
       AND a.attname = 'recorded_by'
  LOOP
    EXECUTE format('ALTER TABLE commission_ledger DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

COMMENT ON COLUMN commission_ledger.recorded_by IS
  'Who recorded the entry: an admin_users id (admin panel) or a users id. Not a foreign key.';
