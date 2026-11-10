-- =====================================================================
-- Migration 042: One more request after a driver's rejection
-- Author: Oabona-Majoko
-- Created: 2026-11-10
--
-- Purpose:
--   A passenger whose request the driver rejected may ask for the same ride
--   once more, in case the rejection was a mistake, and only once. A
--   booking row is reused when a passenger books a ride again, so the row
--   itself has to remember that it was rejected and that the second
--   request has been used.
--
--   New columns with defaults; existing code neither reads nor writes
--   them. Safe to re-run, and safe to apply before the code that uses it.
-- =====================================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS rejected_by_driver BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rerequested_after_rejection BOOLEAN NOT NULL DEFAULT false;
