-- =====================================================================
-- Migration 015: Courier cash on delivery
-- Author: Oabona-Majoko
-- Created: 2026-08-23
--
-- Purpose:
--   Lets a recipient pay cash when they receive a parcel, exactly as a
--   passenger pays cash for a ride.
--
--   This is what makes the courier service launchable. Escrow was the only
--   payment path, and its provider is a mock that moves no money — so nothing
--   could actually be paid for. Cash needs no provider: the money changes
--   hands at the door, and the platform earns through the same commission
--   ledger that already collects on cash rides. The courier accrues what they
--   owe and settles it periodically, and is blocked from taking further cash
--   work once they are too far behind.
--
--   Escrow is kept as an option rather than removed, for whenever a real
--   provider is wired up.
-- =====================================================================

-- 1. How a package is to be paid for. Cash is the default: it is the only
--    method that works today, and the one unbanked senders and recipients can
--    actually use.
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cash_on_delivery';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_packages_payment_method'
  ) THEN
    ALTER TABLE packages ADD CONSTRAINT chk_packages_payment_method CHECK (
      payment_method IN ('cash_on_delivery', 'escrow')
    );
  END IF;
END $$;

-- 2. The agreement records the method it was struck under, so changing the
--    default later cannot retroactively alter how an in-flight delivery is
--    settled.
ALTER TABLE delivery_agreements
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'cash_on_delivery',

  -- Set when the courier confirms they were paid at the door. Distinct from
  -- payment_released_at, which belongs to the escrow path.
  ADD COLUMN IF NOT EXISTS cash_collected_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS cash_amount_collected DECIMAL(12, 2) NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_delivery_agreements_payment_method'
  ) THEN
    ALTER TABLE delivery_agreements ADD CONSTRAINT chk_delivery_agreements_payment_method CHECK (
      payment_method IN ('cash_on_delivery', 'escrow')
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_agreements_payment_method
  ON delivery_agreements (payment_method);

-- 3. The commission ledger already links to cash rides. Courier commission has
--    no CashTransaction behind it — the cash never passes through the platform
--    — so the link is recorded the other way, against the agreement.
ALTER TABLE commission_ledger
  ADD COLUMN IF NOT EXISTS delivery_agreement_id UUID NULL REFERENCES delivery_agreements(id);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_delivery_agreement
  ON commission_ledger (delivery_agreement_id)
  WHERE delivery_agreement_id IS NOT NULL;
