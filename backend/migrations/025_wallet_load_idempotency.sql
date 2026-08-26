-- =====================================================================
-- Migration 025: Make wallet credits idempotent in the database
-- Author: Oabona-Majoko
-- Created: 2026-08-25
--
-- Purpose:
--   A mobile-money wallet top-up is credited by the provider's webhook. The
--   only thing preventing the same webhook crediting twice was a field on a
--   JSON blob in Redis, at `mm_tx:<reference>`, with a 24-hour TTL:
--
--     - the handler credited the wallet, then wrote `status: 'credited'` back
--       via redisClient.set, which swallows its own errors and returns void,
--       so a failed write left the record looking uncredited;
--     - the key lives under `maxmemory-policy allkeys-lru`, so it can be
--       evicted under memory pressure regardless of its TTL;
--     - and Redis being unavailable at all made every guard vanish.
--
--   Payment providers retry webhooks by design. Any of the above turned a
--   retry into a second credit of real money, with nothing in the ledger to
--   say the two rows described one payment.
--
--   Idempotency belongs in the ledger, not in a cache. A unique index makes
--   the second insert fail rather than succeed, whatever Redis is doing.
--
-- Scope:
--   Deliberately partial — `WHERE type = 'load'`. Only a load brings money in
--   from outside, and only a load is replayable by an external caller. Debits
--   and transfers legitimately reuse a source_reference: a ride payment keys
--   on its booking id, and a transfer keys on `transfer_to_<user id>`, which
--   recurs every time the same two people transact.
--
-- Conditional on the table existing:
--   `cash_wallet_transactions` is created by migration 004, and environments
--   baselined by `db:migrate baseline` have 004 recorded as applied without
--   ever having run it — production is one of them, and has no cash wallet
--   tables at all. Failing here would block every later migration on those
--   databases for a feature they do not have. So this no-ops where the table
--   is absent, and the startup schema check is conditional in the same way.
--   Whenever the wallet tables are created, this migration must be re-run or
--   the index added alongside them.
-- =====================================================================

DO $$
DECLARE
  duplicate_count integer;
  sample text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cash_wallet_transactions'
  ) THEN
    RAISE NOTICE 'cash_wallet_transactions does not exist; skipping the wallet load idempotency index.';
    RETURN;
  END IF;

  -- Any duplicate loads already recorded would block the index. Fail loudly
  -- with the offending references rather than silently skipping the
  -- constraint — duplicates here mean money was credited twice and someone
  -- needs to look.
  SELECT COUNT(*), COALESCE(string_agg(DISTINCT source_reference, ', '), '')
    INTO duplicate_count, sample
  FROM (
    SELECT source_reference
    FROM cash_wallet_transactions
    WHERE type = 'load' AND source_reference IS NOT NULL
    GROUP BY source, source_reference
    HAVING COUNT(*) > 1
  ) AS dupes;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add the wallet load idempotency index: % duplicate load reference(s) already exist (%). These are double credits and must be reconciled before this migration can run.',
      duplicate_count, left(sample, 500);
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS cash_wallet_transactions_load_reference_unique
    ON cash_wallet_transactions (source, source_reference)
    WHERE type = 'load' AND source_reference IS NOT NULL;

  COMMENT ON INDEX cash_wallet_transactions_load_reference_unique IS
    'One credit per provider reference. The database, not a Redis key, is what stops a replayed payment webhook crediting a wallet twice.';
END $$;
