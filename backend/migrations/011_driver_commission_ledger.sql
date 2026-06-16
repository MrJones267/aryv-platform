-- =====================================================================
-- Migration 011: Driver Commission Ledger (cash-ride revenue collection)
-- Author: Oabona-Majoko
-- Created: 2026-06-17
--
-- Purpose:
--   Cash rides previously CALCULATED a platform fee but never COLLECTED it.
--   This migration adds a driver-owed commission balance plus an append-only
--   ledger so the platform earns on cash rides while keeping rides fully
--   cash-payable for unbanked riders (riders never need a card/mobile money;
--   the driver settles accrued commission periodically).
-- =====================================================================

-- 1. Extend user_wallets with commission tracking for drivers
ALTER TABLE user_wallets
  ADD COLUMN IF NOT EXISTS commission_owed DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_commission_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS commission_block_threshold DECIMAL(10, 2) NOT NULL DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS last_commission_settled_at TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS idx_user_wallets_commission_owed
  ON user_wallets (commission_owed);

-- 2. Append-only commission ledger
CREATE TABLE IF NOT EXISTS commission_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES users(id),

  -- 'accrual' (commission charged on a cash ride),
  -- 'settlement' (driver paid commission),
  -- 'waiver'/'adjustment' (admin correction)
  entry_type VARCHAR(20) NOT NULL,

  -- Positive increases what the driver owes (accrual);
  -- positive settlement/waiver reduces what is owed.
  amount DECIMAL(12, 2) NOT NULL,

  -- Running balance owed AFTER this entry, for audit/reconciliation.
  balance_after DECIMAL(12, 2) NOT NULL,

  -- How a settlement was made: 'wallet_deduction', 'cash_agent',
  -- 'mobile_money', 'bank_transfer', 'manual'. NULL for accruals.
  settlement_method VARCHAR(30) NULL,

  -- Links back to the source cash transaction (for accruals).
  cash_transaction_id UUID NULL REFERENCES cash_transactions(id),

  -- Admin/system actor that recorded a settlement or adjustment.
  recorded_by UUID NULL REFERENCES users(id),

  description TEXT NULL,
  metadata JSONB NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_driver ON commission_ledger (driver_id);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_entry_type ON commission_ledger (entry_type);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_cash_txn ON commission_ledger (cash_transaction_id);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_created_at ON commission_ledger (created_at);
