-- =====================================================================
-- Migration 032: Tables cash ride payments need, and dispute resolution
-- Author: Oabona-Majoko
-- Created: 2026-10-29
--
-- Purpose:
--   1. trust_holds. Starting a cash payment writes a hold here. The model
--      was never defined, so every cash payment started from the app failed
--      before it committed. Migration 004 declared the table, but production
--      was built from the models, so it is most likely missing there.
--
--   2. cash_disputes. "Report a problem" on a cash payment writes here, and
--      failed the same way. Adds what an admin's resolution records: the
--      payment's status before the dispute, the outcome, the amount the admin
--      decided was paid, and who resolved it. resolved_by and assigned_to
--      hold admin_users ids, so neither is a foreign key to users.
--
--   3. delivery_disputes.resolved_by_admin_id was REFERENCES users(id), but
--      admins live in admin_users, so resolving a courier dispute from the
--      panel failed the foreign key. Dropped, as migration 030 did for
--      commission_ledger.recorded_by.
--
--   Every step is safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS trust_holds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES cash_transactions(id) ON DELETE CASCADE,
  amount DECIMAL(8, 2) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trust_holds_user_id ON trust_holds (user_id);
CREATE INDEX IF NOT EXISTS idx_trust_holds_transaction_id ON trust_holds (transaction_id);
CREATE INDEX IF NOT EXISTS idx_trust_holds_expires_at ON trust_holds (expires_at);

CREATE TABLE IF NOT EXISTS cash_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES cash_transactions(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(100) NOT NULL,
  description TEXT,
  evidence JSONB,
  priority INTEGER NOT NULL DEFAULT 50,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  resolution_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE cash_disputes ADD COLUMN IF NOT EXISTS transaction_status_before VARCHAR(30);
ALTER TABLE cash_disputes ADD COLUMN IF NOT EXISTS outcome VARCHAR(20);
ALTER TABLE cash_disputes ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2);
ALTER TABLE cash_disputes ADD COLUMN IF NOT EXISTS resolved_by UUID;
CREATE INDEX IF NOT EXISTS idx_cash_disputes_transaction_id ON cash_disputes (transaction_id);
CREATE INDEX IF NOT EXISTS idx_cash_disputes_status ON cash_disputes (status);
CREATE INDEX IF NOT EXISTS idx_cash_disputes_priority ON cash_disputes (priority);

-- Foreign keys on columns that hold admin_users ids, whatever they are named.
DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.conrelid::regclass AS tbl, c.conname
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.contype = 'f'
       AND ((c.conrelid = to_regclass('cash_disputes') AND a.attname IN ('assigned_to', 'resolved_by'))
         OR (c.conrelid = to_regclass('delivery_disputes') AND a.attname = 'resolved_by_admin_id'))
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', target.tbl, target.conname);
  END LOOP;
END $$;

COMMENT ON COLUMN cash_disputes.resolved_by IS 'The admin_users id of the admin who resolved it. Not a foreign key.';
