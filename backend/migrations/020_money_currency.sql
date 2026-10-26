-- =====================================================================
-- Migration 020: Give money a currency
-- Author: Oabona-Majoko
-- Created: 2026-08-23
--
-- Purpose:
--   No money record in the system carried a currency. Ride prices, booking
--   totals, wallet balances, commission owed, delivery prices — all bare
--   decimals. A ride priced 200 in Gaborone and one priced 200 in
--   Johannesburg were stored identically despite being worth roughly thirteen
--   times different amounts.
--
--   Three things follow from that, and all three are live:
--
--   1. The cash commission cap is `Math.min(amount * 0.10, 10.00)`. Ten of
--      what? It is ten Pula in Botswana and ten dollars in South Africa,
--      because nothing says which.
--
--   2. Amounts were rendered in whichever currency the *reader* prefers, so a
--      Rand fare shown to a Botswana user was labelled with a Pula symbol.
--      Formatting cannot be correct while the record itself has no currency.
--
--   3. Cross-border rides — which this platform is explicitly for, given the
--      region it serves — cannot be settled or reported on.
--
--   Existing rows default to the platform currency. That is right for
--   effectively all of them: the service has only ever operated from Botswana,
--   and BWP was not even a selectable currency until migration 016.
-- =====================================================================

-- Rides carry the price a driver set, and everything downstream inherits it.
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'BWP';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'BWP';

ALTER TABLE cash_transactions
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'BWP';

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'BWP';

ALTER TABLE delivery_agreements
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'BWP';

-- A wallet holds one currency. Holding several would need a balance per
-- currency, which is a larger change than this and is not needed yet.
ALTER TABLE user_wallets
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'BWP';

ALTER TABLE commission_ledger
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'BWP';

-- Reporting by currency is the whole point of recording it.
CREATE INDEX IF NOT EXISTS idx_bookings_currency ON bookings (currency);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_currency ON commission_ledger (currency);

COMMENT ON COLUMN rides.currency IS
  'ISO 4217. The currency the price is denominated in; bookings inherit it.';
COMMENT ON COLUMN user_wallets.currency IS
  'ISO 4217. A wallet holds a single currency.';
